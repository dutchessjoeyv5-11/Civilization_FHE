pragma solidity ^0.8.24;

import { FHE, euint32, ebool } from "@fhevm/solidity/lib/FHE.sol";
import { SepoliaConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

contract CivilizationFHE is SepoliaConfig {
    using FHE for euint32;
    using FHE for ebool;

    address public owner;
    mapping(address => bool) public isProvider;
    bool public paused;
    uint256 public cooldownSeconds;
    mapping(address => uint256) public lastSubmissionTime;
    mapping(address => uint256) public lastDecryptionRequestTime;
    uint256 public currentBatchId;
    bool public batchOpen;

    struct EspionageReport {
        euint32 techLevel;
        euint32 militaryStrength;
        euint32 goldReserve;
    }
    mapping(uint256 => EspionageReport) public encryptedReports; // batchId -> report

    struct DecryptionContext {
        uint256 batchId;
        bytes32 stateHash;
        bool processed;
    }
    mapping(uint256 => DecryptionContext) public decryptionContexts;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event ProviderAdded(address indexed provider);
    event ProviderRemoved(address indexed provider);
    event Paused(address account);
    event Unpaused(address account);
    event CooldownSecondsSet(uint256 oldCooldown, uint256 newCooldown);
    event BatchOpened(uint256 batchId);
    event BatchClosed(uint256 batchId);
    event EspionageReportSubmitted(address indexed provider, uint256 batchId);
    event DecryptionRequested(uint256 indexed requestId, uint256 batchId);
    event DecryptionCompleted(uint256 indexed requestId, uint256 batchId, uint256 techLevel, uint256 militaryStrength, uint256 goldReserve);

    error NotOwner();
    error NotProvider();
    error PausedState();
    error CooldownActive();
    error BatchClosedOrInvalid();
    error ReplayAttempt();
    error StateMismatch();
    error InvalidBatchId();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyProvider() {
        if (!isProvider[msg.sender]) revert NotProvider();
        _;
    }

    modifier whenNotPaused() {
        if (paused) revert PausedState();
        _;
    }

    modifier respectCooldown(address _address, uint256 _lastTime, string memory _action) {
        if (block.timestamp < _lastTime + cooldownSeconds) revert CooldownActive();
        _;
    }

    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
        cooldownSeconds = 60; // Default cooldown: 1 minute
    }

    function transferOwnership(address newOwner) external onlyOwner {
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function addProvider(address provider) external onlyOwner {
        isProvider[provider] = true;
        emit ProviderAdded(provider);
    }

    function removeProvider(address provider) external onlyOwner {
        isProvider[provider] = false;
        emit ProviderRemoved(provider);
    }

    function pause() external onlyOwner whenNotPaused {
        paused = true;
        emit Paused(msg.sender);
    }

    function unpause() external onlyOwner {
        paused = false;
        emit Unpaused(msg.sender);
    }

    function setCooldownSeconds(uint256 newCooldown) external onlyOwner {
        require(newCooldown > 0, "Cooldown must be positive");
        uint256 oldCooldown = cooldownSeconds;
        cooldownSeconds = newCooldown;
        emit CooldownSecondsSet(oldCooldown, newCooldown);
    }

    function openBatch() external onlyOwner whenNotPaused {
        currentBatchId++;
        batchOpen = true;
        emit BatchOpened(currentBatchId);
    }

    function closeBatch() external onlyOwner whenNotPaused {
        if (!batchOpen) revert BatchClosedOrInvalid();
        batchOpen = false;
        emit BatchClosed(currentBatchId);
    }

    function submitEspionageReport(
        euint32 _encryptedTechLevel,
        euint32 _encryptedMilitaryStrength,
        euint32 _encryptedGoldReserve
    ) external onlyProvider whenNotPaused respectCooldown(msg.sender, lastSubmissionTime[msg.sender], "submission") {
        if (!batchOpen) revert BatchClosedOrInvalid();
        _initIfNeeded(_encryptedTechLevel);
        _initIfNeeded(_encryptedMilitaryStrength);
        _initIfNeeded(_encryptedGoldReserve);

        encryptedReports[currentBatchId] = EspionageReport(_encryptedTechLevel, _encryptedMilitaryStrength, _encryptedGoldReserve);
        lastSubmissionTime[msg.sender] = block.timestamp;
        emit EspionageReportSubmitted(msg.sender, currentBatchId);
    }

    function requestEspionageReportDecryption(uint256 _batchId) external whenNotPaused respectCooldown(msg.sender, lastDecryptionRequestTime[msg.sender], "decryption_request") {
        if (_batchId == 0 || _batchId > currentBatchId) revert InvalidBatchId();

        EspionageReport storage report = encryptedReports[_batchId];
        _requireInitialized(report.techLevel);
        _requireInitialized(report.militaryStrength);
        _requireInitialized(report.goldReserve);

        bytes32[] memory cts = new bytes32[](3);
        cts[0] = FHE.toBytes32(report.techLevel);
        cts[1] = FHE.toBytes32(report.militaryStrength);
        cts[2] = FHE.toBytes32(report.goldReserve);

        bytes32 stateHash = _hashCiphertexts(cts);
        uint256 requestId = FHE.requestDecryption(cts, this.myCallback.selector);

        decryptionContexts[requestId] = DecryptionContext({ batchId: _batchId, stateHash: stateHash, processed: false });
        lastDecryptionRequestTime[msg.sender] = block.timestamp;
        emit DecryptionRequested(requestId, _batchId);
    }

    function myCallback(uint256 requestId, bytes memory cleartexts, bytes memory proof) public {
        if (decryptionContexts[requestId].processed) revert ReplayAttempt();

        DecryptionContext storage ctx = decryptionContexts[requestId];
        uint256 batchId = ctx.batchId;

        EspionageReport storage report = encryptedReports[batchId];
        bytes32[] memory currentCts = new bytes32[](3);
        currentCts[0] = FHE.toBytes32(report.techLevel);
        currentCts[1] = FHE.toBytes32(report.militaryStrength);
        currentCts[2] = FHE.toBytes32(report.goldReserve);

        bytes32 currentStateHash = _hashCiphertexts(currentCts);
        if (currentStateHash != ctx.stateHash) revert StateMismatch();

        FHE.checkSignatures(requestId, cleartexts, proof);

        uint256 techLevel = abi.decode(cleartexts, (uint256));
        cleartexts = cleartexts[32:];
        uint256 militaryStrength = abi.decode(cleartexts, (uint256));
        cleartexts = cleartexts[32:];
        uint256 goldReserve = abi.decode(cleartexts, (uint256));

        ctx.processed = true;
        emit DecryptionCompleted(requestId, batchId, techLevel, militaryStrength, goldReserve);
    }

    function _hashCiphertexts(bytes32[] memory cts) internal pure returns (bytes32) {
        return keccak256(abi.encode(cts, address(this)));
    }

    function _initIfNeeded(euint32 x) internal {
        if (!FHE.isInitialized(x)) {
            x = FHE.asEuint32(0);
        }
    }

    function _requireInitialized(euint32 x) internal pure {
        if (!FHE.isInitialized(x)) revert("Ciphertext not initialized");
    }
}
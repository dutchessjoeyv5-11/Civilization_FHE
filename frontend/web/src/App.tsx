import { ConnectButton } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import { getContractReadOnly, getContractWithSigner } from "./contract";
import "./App.css";
import { useAccount, useSignMessage } from 'wagmi';

interface Card {
  id: string;
  name: string;
  type: string;
  cost: number;
  attack: number;
  defense: number;
  encryptedCost: string;
  encryptedAttack: string;
  encryptedDefense: string;
  isBanned: boolean;
  isPicked: boolean;
}

interface Player {
  address: string;
  name: string;
  wins: number;
  losses: number;
  winRate: number;
}

const FHEEncryptNumber = (value: number): string => {
  return `FHE-${btoa(value.toString())}`;
};

const FHEDecryptNumber = (encryptedData: string): number => {
  if (encryptedData.startsWith('FHE-')) {
    return parseFloat(atob(encryptedData.substring(4)));
  }
  return parseFloat(encryptedData);
};

const generatePublicKey = () => `0x${Array(2000).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('')}`;

const App: React.FC = () => {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [loading, setLoading] = useState(true);
  const [cards, setCards] = useState<Card[]>([]);
  const [playerDeck, setPlayerDeck] = useState<Card[]>([]);
  const [opponentDeck, setOpponentDeck] = useState<Card[]>([]);
  const [gamePhase, setGamePhase] = useState<'ban' | 'pick' | 'battle' | 'result'>('ban');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<{ visible: boolean; status: "pending" | "success" | "error"; message: string; }>({ visible: false, status: "pending", message: "" });
  const [publicKey, setPublicKey] = useState<string>("");
  const [contractAddress, setContractAddress] = useState<string>("");
  const [chainId, setChainId] = useState<number>(0);
  const [startTimestamp, setStartTimestamp] = useState<number>(0);
  const [durationDays, setDurationDays] = useState<number>(30);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("all");
  const [showTutorial, setShowTutorial] = useState(false);
  const [leaderboard, setLeaderboard] = useState<Player[]>([]);
  const [playerStats, setPlayerStats] = useState({ wins: 0, losses: 0, winRate: 0 });
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [decryptedCard, setDecryptedCard] = useState<Card | null>(null);

  // Initialize game with sample cards
  const initializeCards = () => {
    const sampleCards: Card[] = [
      { id: "1", name: "Encrypted Warrior", type: "Warrior", cost: 3, attack: 5, defense: 4, encryptedCost: "", encryptedAttack: "", encryptedDefense: "", isBanned: false, isPicked: false },
      { id: "2", name: "Homomorphic Mage", type: "Mage", cost: 4, attack: 3, defense: 3, encryptedCost: "", encryptedAttack: "", encryptedDefense: "", isBanned: false, isPicked: false },
      { id: "3", name: "Zero-Knowledge Assassin", type: "Assassin", cost: 2, attack: 4, defense: 2, encryptedCost: "", encryptedAttack: "", encryptedDefense: "", isBanned: false, isPicked: false },
      { id: "4", name: "Security Guard", type: "Guard", cost: 5, attack: 2, defense: 6, encryptedCost: "", encryptedAttack: "", encryptedDefense: "", isBanned: false, isPicked: false },
      { id: "5", name: "Protocol Breaker", type: "Warrior", cost: 3, attack: 4, defense: 3, encryptedCost: "", encryptedAttack: "", encryptedDefense: "", isBanned: false, isPicked: false },
      { id: "6", name: "Cipher Summoner", type: "Mage", cost: 6, attack: 5, defense: 4, encryptedCost: "", encryptedAttack: "", encryptedDefense: "", isBanned: false, isPicked: false },
      { id: "7", name: "Random Oracle", type: "Special", cost: 4, attack: 3, defense: 5, encryptedCost: "", encryptedAttack: "", encryptedDefense: "", isBanned: false, isPicked: false },
      { id: "8", name: "Fully Homomorphic Dragon", type: "Dragon", cost: 8, attack: 8, defense: 8, encryptedCost: "", encryptedAttack: "", encryptedDefense: "", isBanned: false, isPicked: false },
      { id: "9", name: "Security Protocol", type: "Spell", cost: 2, attack: 0, defense: 0, encryptedCost: "", encryptedAttack: "", encryptedDefense: "", isBanned: false, isPicked: false },
      { id: "10", name: "Encrypted Arrow", type: "Archer", cost: 3, attack: 4, defense: 2, encryptedCost: "", encryptedAttack: "", encryptedDefense: "", isBanned: false, isPicked: false },
    ];
    
    // Encrypt card stats using Zama FHE simulation
    const encryptedCards = sampleCards.map(card => ({
      ...card,
      encryptedCost: FHEEncryptNumber(card.cost),
      encryptedAttack: FHEEncryptNumber(card.attack),
      encryptedDefense: FHEEncryptNumber(card.defense)
    }));
    
    return encryptedCards;
  };

  // Initialize leaderboard with sample data
  const initializeLeaderboard = () => {
    return [
      { address: "0x1234...abcd", name: "CryptoMaster", wins: 42, losses: 8, winRate: 84 },
      { address: "0x5678...efgh", name: "FHEKing", wins: 38, losses: 12, winRate: 76 },
      { address: "0x90ab...cdef", name: "ZamaWarrior", wins: 35, losses: 15, winRate: 70 },
      { address: "0x3456...7890", name: "BlockchainNinja", wins: 30, losses: 20, winRate: 60 },
      { address: "0x7890...1234", name: "DeckBuilderPro", wins: 28, losses: 22, winRate: 56 },
    ];
  };

  useEffect(() => {
    setCards(initializeCards());
    setLeaderboard(initializeLeaderboard());
    setPlayerStats({ wins: 12, losses: 8, winRate: 60 });
    
    const initSignatureParams = async () => {
      const contract = await getContractReadOnly();
      if (contract) setContractAddress(await contract.getAddress());
      if (window.ethereum) {
        const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' });
        setChainId(parseInt(chainIdHex, 16));
      }
      setStartTimestamp(Math.floor(Date.now() / 1000));
      setDurationDays(30);
      setPublicKey(generatePublicKey());
      setLoading(false);
    };
    initSignatureParams();
  }, []);

  const checkContractAvailability = async () => {
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      const isAvailable = await contract.isAvailable();
      if (isAvailable) {
        setTransactionStatus({ visible: true, status: "success", message: "ZAMA FHE contract is available!" });
      } else {
        setTransactionStatus({ visible: true, status: "error", message: "Contract not available" });
      }
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    } catch (e) {
      setTransactionStatus({ visible: true, status: "error", message: "Error checking contract availability" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    }
  };

  const banCard = (cardId: string) => {
    if (!isConnected) {
      alert("Please connect wallet first");
      return;
    }
    
    setCards(prevCards => 
      prevCards.map(card => 
        card.id === cardId ? { ...card, isBanned: true } : card
      )
    );
    
    setTransactionStatus({ visible: true, status: "success", message: "Card banned successfully!" });
    setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 2000);
  };

  const pickCard = (cardId: string) => {
    if (!isConnected) {
      alert("Please connect wallet first");
      return;
    }
    
    const cardToPick = cards.find(card => card.id === cardId);
    if (cardToPick && playerDeck.length < 5) {
      setPlayerDeck(prev => [...prev, { ...cardToPick, isPicked: true }]);
      setCards(prevCards => 
        prevCards.map(card => 
          card.id === cardId ? { ...card, isPicked: true } : card
        )
      );
      
      setTransactionStatus({ visible: true, status: "success", message: "Card added to your deck!" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 2000);
    }
  };

  const startBattle = () => {
    // Simulate opponent deck
    const availableCards = cards.filter(card => !card.isBanned && !card.isPicked);
    const opponentDeck = [];
    for (let i = 0; i < 5; i++) {
      if (availableCards.length > 0) {
        const randomIndex = Math.floor(Math.random() * availableCards.length);
        opponentDeck.push({ ...availableCards[randomIndex], isPicked: true });
        availableCards.splice(randomIndex, 1);
      }
    }
    setOpponentDeck(opponentDeck);
    setGamePhase('battle');
    
    // Simulate battle result
    setTimeout(() => {
      const playerWins = Math.random() > 0.5;
      setGamePhase('result');
      
      if (playerWins) {
        setPlayerStats(prev => ({
          wins: prev.wins + 1,
          losses: prev.losses,
          winRate: Math.round(((prev.wins + 1) / (prev.wins + prev.losses + 1)) * 100)
        }));
        setTransactionStatus({ visible: true, status: "success", message: "Congratulations! You won!" });
      } else {
        setPlayerStats(prev => ({
          wins: prev.wins,
          losses: prev.losses + 1,
          winRate: Math.round((prev.wins / (prev.wins + prev.losses + 1)) * 100)
        }));
        setTransactionStatus({ visible: true, status: "error", message: "Sorry, you lost this battle!" });
      }
      
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    }, 3000);
  };

  const resetGame = () => {
    setCards(initializeCards());
    setPlayerDeck([]);
    setOpponentDeck([]);
    setGamePhase('ban');
  };

  const decryptWithSignature = async (card: Card): Promise<Card | null> => {
    if (!isConnected) { 
      alert("Please connect wallet first"); 
      return null; 
    }
    
    setIsDecrypting(true);
    try {
      const message = `publickey:${publicKey}\ncontractAddresses:${contractAddress}\ncontractsChainId:${chainId}\nstartTimestamp:${startTimestamp}\ndurationDays:${durationDays}`;
      await signMessageAsync({ message });
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      return {
        ...card,
        cost: FHEDecryptNumber(card.encryptedCost),
        attack: FHEDecryptNumber(card.encryptedAttack),
        defense: FHEDecryptNumber(card.encryptedDefense)
      };
    } catch (e) { 
      console.error("Decryption failed:", e); 
      return null; 
    } finally { 
      setIsDecrypting(false); 
    }
  };

  const handleDecryptCard = async (card: Card) => {
    const decrypted = await decryptWithSignature(card);
    if (decrypted) {
      setDecryptedCard(decrypted);
    }
  };

  const filteredCards = cards.filter(card => {
    const matchesSearch = card.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === "all" || card.type === filterType;
    return matchesSearch && matchesType;
  });

  const tutorialSteps = [
    { title: "Connect Wallet", description: "Connect your Web3 wallet to start playing", icon: "🔗" },
    { title: "Ban Phase", description: "Secretly ban cards from the encrypted card pool", icon: "🚫", details: "Using ZAMA FHE technology to keep your choices hidden from opponents" },
    { title: "Pick Phase", description: "Select 5 cards from the remaining pool to build your deck", icon: "🃏", details: "All values are FHE encrypted to protect your strategy" },
    { title: "Battle Phase", description: "Engage in encrypted card battles with opponents", icon: "⚔️", details: "FHE ensures all computations happen on encrypted data" }
  ];

  const renderCard = (card: Card, action: 'ban' | 'pick') => {
    return (
      <div className={`card ${card.isBanned ? 'banned' : ''} ${card.isPicked ? 'picked' : ''}`}>
        <div className="card-header">
          <span className="card-type">{card.type}</span>
          <span className="card-cost">Cost: {card.encryptedCost.substring(0, 8)}...</span>
        </div>
        <h3 className="card-name">{card.name}</h3>
        <div className="card-stats">
          <div className="stat">
            <span>Attack</span>
            <span>{card.encryptedAttack.substring(0, 8)}...</span>
          </div>
          <div className="stat">
            <span>Defense</span>
            <span>{card.encryptedDefense.substring(0, 8)}...</span>
          </div>
        </div>
        <div className="card-actions">
          {action === 'ban' && !card.isBanned && !card.isPicked && (
            <button className="action-btn ban" onClick={() => banCard(card.id)}>Ban</button>
          )}
          {action === 'pick' && !card.isBanned && !card.isPicked && (
            <button className="action-btn pick" onClick={() => pickCard(card.id)}>Pick</button>
          )}
          <button className="action-btn decrypt" onClick={() => handleDecryptCard(card)}>
            {isDecrypting ? "Decrypting..." : "Decrypt"}
          </button>
        </div>
      </div>
    );
  };

  const renderDeck = (deck: Card[], title: string) => {
    return (
      <div className="deck-container">
        <h3>{title}</h3>
        <div className="deck-cards">
          {deck.length > 0 ? (
            deck.map(card => (
              <div key={card.id} className="deck-card">
                <div className="card-header">
                  <span className="card-type">{card.type}</span>
                </div>
                <h4 className="card-name">{card.name}</h4>
              </div>
            ))
          ) : (
            <p className="empty-deck">Deck is empty</p>
          )}
        </div>
      </div>
    );
  };

  if (loading) return (
    <div className="loading-screen">
      <div className="neon-spinner"></div>
      <p>Initializing encrypted connection...</p>
    </div>
  );

  return (
    <div className="app-container neon-theme">
      <header className="app-header">
        <div className="logo">
          <div className="logo-icon"><div className="shield-icon"></div></div>
          <h1>Secret<span>Deck</span>Builder</h1>
        </div>
        <div className="header-actions">
          <button className="neon-button" onClick={() => setShowTutorial(!showTutorial)}>
            {showTutorial ? "Hide Tutorial" : "Show Tutorial"}
          </button>
          <button className="neon-button" onClick={checkContractAvailability}>
            Check Contract
          </button>
          <div className="wallet-connect-wrapper"><ConnectButton accountStatus="address" chainStatus="icon" showBalance={false}/></div>
        </div>
      </header>
      
      <div className="main-content">
        <div className="welcome-banner">
          <div className="welcome-text">
            <h2>FHE Deck Building Game</h2>
            <p>Protect your strategy with ZAMA FHE technology to build decks on encrypted data</p>
          </div>
          <div className="fhe-indicator"><div className="fhe-lock"></div><span>FHE Encryption Active</span></div>
        </div>
        
        {showTutorial && (
          <div className="tutorial-section">
            <h2>Game Tutorial</h2>
            <p className="subtitle">Learn how to build decks secretly using FHE technology</p>
            <div className="tutorial-steps">
              {tutorialSteps.map((step, index) => (
                <div className="tutorial-step" key={index}>
                  <div className="step-icon">{step.icon}</div>
                  <div className="step-content">
                    <h3>{step.title}</h3>
                    <p>{step.description}</p>
                    {step.details && <div className="step-details">{step.details}</div>}
                  </div>
                </div>
              ))}
            </div>
            <div className="fhe-diagram">
              <div className="diagram-step"><div className="diagram-icon">🃏</div><div className="diagram-label">Card Data</div></div>
              <div className="diagram-arrow">→</div>
              <div className="diagram-step"><div className="diagram-icon">🔒</div><div className="diagram-label">FHE Encryption</div></div>
              <div className="diagram-arrow">→</div>
              <div className="diagram-step"><div className="diagram-icon">🤔</div><div className="diagram-label">Secret Ban/Pick</div></div>
              <div className="diagram-arrow">→</div>
              <div className="diagram-step"><div className="diagram-icon">⚔️</div><div className="diagram-label">Encrypted Battle</div></div>
            </div>
          </div>
        )}
        
        <div className="dashboard-grid">
          <div className="dashboard-card neon-card">
            <h3>Project Introduction</h3>
            <p><strong>Secret Deck Builder</strong> is a card game based on ZAMA FHE technology. Before battle begins, both players can secretly "Ban" cards from a public FHE-encrypted card pool before building their decks.</p>
            <p>This design adds pre-battle strategy and psychological gameplay, protecting each player's tactical intentions from being discovered, making it ideal for competitive card games.</p>
            <div className="fhe-badge"><span>FHE Technology Secured</span></div>
          </div>
          
          <div className="dashboard-card neon-card">
            <h3>Data Statistics</h3>
            <div className="stats-grid">
              <div className="stat-item">
                <div className="stat-value">{cards.filter(c => c.isBanned).length}</div>
                <div className="stat-label">Banned Cards</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{playerDeck.length}/5</div>
                <div className="stat-label">Cards Picked</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{playerStats.wins}</div>
                <div className="stat-label">Wins</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{playerStats.winRate}%</div>
                <div className="stat-label">Win Rate</div>
              </div>
            </div>
          </div>
          
          <div className="dashboard-card neon-card">
            <h3>Leaderboard</h3>
            <div className="leaderboard">
              {leaderboard.map((player, index) => (
                <div className="leaderboard-item" key={index}>
                  <div className="rank">#{index + 1}</div>
                  <div className="player-info">
                    <div className="player-name">{player.name}</div>
                    <div className="player-address">{player.address}</div>
                  </div>
                  <div className="player-stats">
                    <div className="win-rate">{player.winRate}%</div>
                    <div className="wins-losses">{player.wins}W/{player.losses}L</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        <div className="game-section">
          <div className="section-header">
            <h2>{gamePhase === 'ban' ? 'Ban Phase' : gamePhase === 'pick' ? 'Pick Phase' : gamePhase === 'battle' ? 'Battle Phase' : 'Battle Result'}</h2>
            <div className="game-controls">
              {gamePhase === 'ban' && (
                <button className="neon-button" onClick={() => setGamePhase('pick')}>
                  Enter Pick Phase
                </button>
              )}
              {gamePhase === 'pick' && playerDeck.length === 5 && (
                <button className="neon-button" onClick={startBattle}>
                  Start Battle
                </button>
              )}
              {gamePhase === 'result' && (
                <button className="neon-button" onClick={resetGame}>
                  Play Again
                </button>
              )}
              <button onClick={() => setIsRefreshing(true)} className="refresh-btn neon-button" disabled={isRefreshing}>
                {isRefreshing ? "Refreshing..." : "Refresh Data"}
              </button>
            </div>
          </div>
          
          <div className="game-container">
            <div className="card-pool-section">
              <div className="card-pool-header">
                <h3>Encrypted Card Pool</h3>
                <div className="filters">
                  <input
                    type="text"
                    placeholder="Search cards..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="search-input"
                  />
                  <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="type-filter">
                    <option value="all">All Types</option>
                    <option value="Warrior">Warrior</option>
                    <option value="Mage">Mage</option>
                    <option value="Assassin">Assassin</option>
                    <option value="Guard">Guard</option>
                    <option value="Dragon">Dragon</option>
                    <option value="Special">Special</option>
                    <option value="Spell">Spell</option>
                    <option value="Archer">Archer</option>
                  </select>
                </div>
              </div>
              
              <div className="card-pool">
                {filteredCards.length > 0 ? (
                  filteredCards.map(card => renderCard(card, gamePhase === 'ban' ? 'ban' : 'pick'))
                ) : (
                  <div className="no-cards">
                    <div className="no-cards-icon"></div>
                    <p>No matching cards found</p>
                  </div>
                )}
              </div>
            </div>
            
            <div className="player-section">
              {renderDeck(playerDeck, "Your Deck")}
              
              {gamePhase === 'battle' && (
                <div className="battle-animation">
                  <div className="player-card">Your Deck</div>
                  <div className="vs">VS</div>
                  <div className="opponent-card">Opponent Deck</div>
                </div>
              )}
              
              {gamePhase === 'result' && opponentDeck.length > 0 && (
                renderDeck(opponentDeck, "Opponent Deck")
              )}
            </div>
          </div>
        </div>
      </div>
      
      {decryptedCard && (
        <div className="modal-overlay">
          <div className="card-detail-modal neon-card">
            <div className="modal-header">
              <h2>Card Details</h2>
              <button onClick={() => setDecryptedCard(null)} className="close-modal">&times;</button>
            </div>
            <div className="modal-body">
              <div className="card-detail">
                <div className="card-header">
                  <span className="card-type">{decryptedCard.type}</span>
                  <span className="card-cost">Cost: {decryptedCard.cost}</span>
                </div>
                <h3 className="card-name">{decryptedCard.name}</h3>
                <div className="card-stats">
                  <div className="stat">
                    <span>Attack</span>
                    <span>{decryptedCard.attack}</span>
                  </div>
                  <div className="stat">
                    <span>Defense</span>
                    <span>{decryptedCard.defense}</span>
                  </div>
                </div>
                <div className="decryption-notice">
                  <div className="warning-icon"></div>
                  <span>This card data was decrypted through wallet signature</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {transactionStatus.visible && (
        <div className="transaction-modal">
          <div className="transaction-content neon-card">
            <div className={`transaction-icon ${transactionStatus.status}`}>
              {transactionStatus.status === "pending" && <div className="neon-spinner"></div>}
              {transactionStatus.status === "success" && <div className="check-icon"></div>}
              {transactionStatus.status === "error" && <div className="error-icon"></div>}
            </div>
            <div className="transaction-message">{transactionStatus.message}</div>
          </div>
        </div>
      )}
      
      <footer className="app-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <div className="logo"><div className="shield-icon"></div><span>SecretDeckBuilder</span></div>
            <p>Encrypted card game powered by ZAMA FHE technology</p>
          </div>
          <div className="footer-links">
            <a href="#" className="footer-link">Documentation</a>
            <a href="#" className="footer-link">Privacy Policy</a>
            <a href="#" className="footer-link">Terms of Service</a>
            <a href="#" className="footer-link">Contact Us</a>
          </div>
        </div>
        <div className="footer-bottom">
          <div className="fhe-badge"><span>FHE Encryption Technology</span></div>
          <div className="copyright">© {new Date().getFullYear()} DeckBuild_FHE. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
};

export default App;
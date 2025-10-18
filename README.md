# Civilization: Encrypted Espionage Game

Civilization is a strategy simulation game that leverages **Zama's Fully Homomorphic Encryption (FHE) technology** to bring an innovative twist to gameplay—encrypted espionage. Players engage in a vast world of civilization-building while discretely managing spies, who operate within a framework of FHE to steal encrypted technological and military information from opponents. The game combines history, grand strategy, and espionage in a secure and thrilling environment.

## Identifying the Challenge

In traditional strategy games, players often exploit vulnerabilities in data to gain an unfair advantage, which undermines the integrity of the gameplay. Information is usually transparent, exposing players to potential cheats and strategies that can be easily countered through simple data comparisons. This not only diminishes the enjoyment for honest players but also stifles the strategic depth that makes such games compelling.

## How FHE Transforms the Game

By utilizing **Zama's open-source libraries**, such as **Concrete** and the **zama-fhe SDK**, this project innovatively addresses the problem of data transparency. The FHE technology enables spies to execute actions on encrypted data, allowing them to generate intelligence without revealing sensitive information about their own military capabilities or technology. The intelligence retrieved is also encrypted and provides mere hints, making it difficult for players to devise counter-strategies based on raw data. This creates a truly immersive experience where strategy and deception thrive under the veil of encryption.

## Core Features

- **Encrypted Espionage System**: Players can deploy spies to conduct operations on encrypted data, making it impossible for opponents to discern their strategies through data comparison.
- **Intelligence Reports**: The system generates encrypted reports that provide ambiguous hints about competitors' capabilities, increasing the uncertainty and strategy required in gameplay.
- **Homomorphic Actions**: Spying actions are performed homomorphically on encrypted data, ensuring confidentiality while enabling players to make informed decisions.
- **Spy Management Panel**: Offers an intuitive interface for players to manage their spies and view intelligence reports in a user-friendly format.

## Technology Stack

- **Zama FHE SDK**: The foundation for FHE implementations and confidential computing.
- **Node.js**: For server-side development and management.
- **Hardhat/Foundry**: Used for smart contract development and testing.
- **Solidity**: The programming language for writing smart contracts.

## Directory Structure

Below is the directory structure of the project:

```
Civilization_FHE/
├── contracts/
│   └── Civilization.sol
├── src/
│   ├── spies/
│   │   └── spyManagement.js
│   ├── reports/
│   │   └── intelligenceReport.js
│   └── main.js
├── tests/
│   └── espionage.test.js
├── package.json
└── README.md
```

## Installation Steps

Follow these steps to set up the project on your local machine:

1. Ensure you have **Node.js** and **npm** installed on your system.
2. Navigate to the root directory of the project in your terminal.
3. Run the command below to install all dependencies, including the necessary Zama FHE libraries:
   ```bash
   npm install
   ```
4. Make sure to install Hardhat or Foundry as needed for your development environment:
   ```bash
   npm install --save-dev hardhat
   ```

**Note**: Please refrain from using `git clone` or any URLs to download this project. The project source files must be obtained in the correct manner outlined here.

## Building and Running the Project

After successfully setting up the project, you can compile the smart contracts and run the project using the following commands:

1. To compile the smart contracts, execute:
   ```bash
   npx hardhat compile
   ```
2. To run the tests and ensure everything is functioning as expected:
   ```bash
   npx hardhat test
   ```
3. To start the project and begin playing the game, run:
   ```bash
   npx hardhat run src/main.js
   ```

## Code Example

Here’s a simplified code snippet demonstrating how the espionage system interacts with encrypted data:

```javascript
// spyManagement.js

const { encryptData, executeSpyAction } = require('../lib/encryptionLib');

function deploySpy(spyId, target) {
  const encryptedData = encryptData(target.technologies);
  const missionOutcome = executeSpyAction(spyId, encryptedData);

  if (missionOutcome.success) {
    console.log("Spy successfully executed the mission!");
    return missionOutcome.encryptedReport;
  } else {
    console.log("Spy mission failed.");
    return null;
  }
}
```

This code represents the core functionality of deploying a spy and executing an espionage action on encrypted data, demonstrating the gameplay dynamics while maintaining confidentiality.

## Acknowledgements

**Powered by Zama**: A heartfelt thank you to the Zama team for their pioneering work in Fully Homomorphic Encryption and for providing the open-source tools necessary to develop secure and confidential blockchain applications. Your innovations are instrumental in shaping the future of strategy games like Civilization.

In conclusion, this project showcases the profound capabilities of Zama's FHE technology, propelling traditional gameplay into a new era of security and strategy. Dive into the world of Civilization and experience espionage like never before!
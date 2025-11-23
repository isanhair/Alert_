# Private Disaster Warning

Private Disaster Warning is a pioneering application that harnesses Zama's Fully Homomorphic Encryption (FHE) technology to provide timely disaster alerts without compromising user privacy. By using encrypted user location data, our system delivers targeted notifications while ensuring that no sensitive information is collected or stored. This innovative approach empowers communities to stay informed about emergencies without sacrificing their personal data.

## The Problem

In today's digital landscape, the reliance on cleartext data for emergency alerts presents significant privacy and security risks. Traditional systems often collect and store user location information, which can be exploited or misused by malicious entities. This raises serious concerns regarding user consent and data breaches, particularly when it comes to sensitive locations during disasters. 

Our project addresses these gaps by offering a way to send disaster warnings while maintaining the confidentiality of users’ whereabouts, providing peace of mind and increased trust in public safety communications.

## The Zama FHE Solution

Fully Homomorphic Encryption offers a groundbreaking solution to the outlined privacy dilemmas. By allowing computations on encrypted data, Zama's technology facilitates the processing of user locations without ever revealing the underlying sensitive information.

Using the fhevm library, we can securely handle and compute encrypted inputs to generate disaster notifications. This ensures that we can send essential alerts without needing to expose or store any cleartext location data, thus significantly enhancing user privacy.

## Key Features

- 🔒 **Privacy-First Approach**: Operates solely on encrypted data, preserving user privacy at all stages.
- 🚨 **Real-Time Alerts**: Sends timely notifications to users based on encrypted location information.
- 🗺️ **Location-Based Services**: Provides targeted alerts without ever collecting location data in cleartext.
- 📊 **Aggregate Data Insights**: Gathers anonymized metrics to improve emergency response without compromising individual privacy.
- 🛠️ **Customizable Settings**: Users can set their preferences for receiving alerts while maintaining control over their data.

## Technical Architecture & Stack

Our project is built using a robust tech stack centered around Zama's FHE capabilities. The architecture consists of the following components:

- **Core Privacy Engine**: Zama's fhevm
- **Frontend**: User interface for alert management and settings
- **Backend**: Logic to process alerts using encrypted data
- **Storage**: Secure methods to handle metadata without compromising user information

## Smart Contract / Core Logic

Here's a simplified pseudo-code snippet that illustrates how our application handles disaster alerts using Zama's technology:

```solidity
pragma solidity ^0.8.0;

import "fhevm.sol";

contract DisasterAlert {
    struct Alert {
        uint64 timestamp;
        string message;
    }

    mapping(address => Alert) public alerts;

    function sendAlert(uint64 locationEncrypted) public {
        // Decrypt the location
        uint64 decryptedLocation = TFHE.decrypt(locationEncrypted);
        
        // Generate the alert message
        string memory alertMessage = "Emergency alert for location: " + uint2str(decryptedLocation);
        
        // Store the alert
        alerts[msg.sender] = Alert(block.timestamp, alertMessage);
        
        // Send alert to user (not shown for security)
    }
}
```

This code snippet depicts how disaster alerts could be initiated based on encrypted location data while ensuring that user location privacy is maintained at all times.

## Directory Structure

The project directory is organized as follows:

```
Private-Disaster-Warning/
├── src/
│   ├── alert_manager.sol
│   ├── utils.sol
│   └── main.py
├── config/
│   └── settings.py
├── tests/
│   ├── test_alert_manager.py
│   └── test_utils.py
└── README.md
```

This structure separates the smart contracts, configuration files, and tests, ensuring that every aspect of the application is modular and maintainable.

## Installation & Setup

### Prerequisites

Before you begin, ensure you have the following installed:

- Node.js and npm (for JavaScript dependencies)
- Python 3.x (for scripting and testing)

### Dependencies

To get started, you'll need to install the necessary dependencies:

1. For JavaScript components, run:
   ```bash
   npm install fhevm
   ```

2. For Python components, run:
   ```bash
   pip install concrete-ml
   ```

## Build & Run

To build and run the application, execute the following commands:

1. Compile the smart contracts:
   ```bash
   npx hardhat compile
   ```

2. Run the Python script that manages alerts:
   ```bash
   python main.py
   ```

These commands will get your Private Disaster Warning application up and running efficiently.

## Acknowledgements

We extend our sincere gratitude to Zama for providing the open-source Fully Homomorphic Encryption primitives that make this project possible. Their advancements in the field of secure computation enable us to protect user privacy while delivering critical information in times of need. 

Feel free to reach out with thoughts, questions, or suggestions. Together, we can enhance community safety and privacy through innovative technology!



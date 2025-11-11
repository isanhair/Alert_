pragma solidity ^0.8.24;

import { FHE, euint32, externalEuint32 } from "@fhevm/solidity/lib/FHE.sol";
import { ZamaEthereumConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

contract AlertZama is ZamaEthereumConfig {
    struct Alert {
        euint32 encryptedLocation;
        uint256 alertType;
        uint256 severityLevel;
        uint256 timestamp;
        bool isActive;
    }

    struct User {
        euint32 encryptedLocation;
        bool registered;
    }

    mapping(uint256 => Alert) public alerts;
    mapping(address => User) public users;
    uint256 public alertCount;

    event AlertCreated(uint256 indexed alertId, uint256 alertType, uint256 severityLevel);
    event UserRegistered(address indexed userAddress);
    event AlertTriggered(uint256 indexed alertId, address indexed userAddress);

    constructor() ZamaEthereumConfig() {
        alertCount = 0;
    }

    function registerUser(externalEuint32 encryptedLocation, bytes calldata inputProof) external {
        require(!users[msg.sender].registered, "User already registered");

        euint32 encryptedLoc = FHE.fromExternal(encryptedLocation, inputProof);
        require(FHE.isInitialized(encryptedLoc), "Invalid encrypted input");

        users[msg.sender] = User({
            encryptedLocation: encryptedLoc,
            registered: true
        });

        FHE.allowThis(users[msg.sender].encryptedLocation);
        FHE.makePubliclyDecryptable(users[msg.sender].encryptedLocation);

        emit UserRegistered(msg.sender);
    }

    function createAlert(
        externalEuint32 encryptedLocation,
        bytes calldata inputProof,
        uint256 alertType,
        uint256 severityLevel
    ) external {
        euint32 encryptedLoc = FHE.fromExternal(encryptedLocation, inputProof);
        require(FHE.isInitialized(encryptedLoc), "Invalid encrypted input");

        alerts[alertCount] = Alert({
            encryptedLocation: encryptedLoc,
            alertType: alertType,
            severityLevel: severityLevel,
            timestamp: block.timestamp,
            isActive: true
        });

        FHE.allowThis(alerts[alertCount].encryptedLocation);
        FHE.makePubliclyDecryptable(alerts[alertCount].encryptedLocation);

        emit AlertCreated(alertCount, alertType, severityLevel);
        alertCount++;
    }

    function checkAlertEligibility(
        uint256 alertId,
        address userAddress,
        bytes memory comparisonProof
    ) external view returns (bool) {
        require(alerts[alertId].isActive, "Alert is not active");
        require(users[userAddress].registered, "User not registered");

        euint32 alertLocation = alerts[alertId].encryptedLocation;
        euint32 userLocation = users[userAddress].encryptedLocation;

        // Homomorphically compare locations
        bool isEligible = FHE.run(
            abi.encode(userLocation, alertLocation),
            comparisonProof
        );

        if (isEligible) {
            emit AlertTriggered(alertId, userAddress);
        }

        return isEligible;
    }

    function getAlert(uint256 alertId) external view returns (
        uint256 alertType,
        uint256 severityLevel,
        uint256 timestamp,
        bool isActive
    ) {
        Alert storage alert = alerts[alertId];
        return (
            alert.alertType,
            alert.severityLevel,
            alert.timestamp,
            alert.isActive
        );
    }

    function getUser(address userAddress) external view returns (bool registered) {
        return users[userAddress].registered;
    }

    function getAlertCount() external view returns (uint256) {
        return alertCount;
    }

    function deactivateAlert(uint256 alertId) external {
        require(alerts[alertId].isActive, "Alert already deactivated");
        alerts[alertId].isActive = false;
    }

    function verifyAlertDecryption(
        uint256 alertId,
        bytes memory abiEncodedClearValue,
        bytes memory decryptionProof
    ) external {
        require(alerts[alertId].isActive, "Alert is not active");

        bytes32[] memory cts = new bytes32[](1);
        cts[0] = FHE.toBytes32(alerts[alertId].encryptedLocation);

        FHE.checkSignatures(cts, abiEncodedClearValue, decryptionProof);
    }
}



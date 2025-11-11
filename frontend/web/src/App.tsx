import { ConnectButton } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import React, { useEffect, useState } from "react";
import { getContractReadOnly, getContractWithSigner } from "./components/useContract";
import "./App.css";
import { useAccount } from 'wagmi';
import { useFhevm, useEncrypt, useDecrypt } from '../fhevm-sdk/src';

interface WarningData {
  id: string;
  name: string;
  locationIndex: number;
  severity: number;
  timestamp: number;
  creator: string;
  publicValue1: number;
  publicValue2: number;
  isVerified?: boolean;
  decryptedValue?: number;
}

const App: React.FC = () => {
  const { address, isConnected } = useAccount();
  const [loading, setLoading] = useState(true);
  const [warnings, setWarnings] = useState<WarningData[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creatingWarning, setCreatingWarning] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<{ visible: boolean; status: "pending" | "success" | "error"; message: string; }>({ 
    visible: false, 
    status: "pending", 
    message: "" 
  });
  const [newWarningData, setNewWarningData] = useState({ name: "", locationIndex: "", severity: "" });
  const [selectedWarning, setSelectedWarning] = useState<WarningData | null>(null);
  const [decryptedData, setDecryptedData] = useState<number | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [contractAddress, setContractAddress] = useState("");
  const [fhevmInitializing, setFhevmInitializing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterSeverity, setFilterSeverity] = useState("all");

  const { status, initialize, isInitialized } = useFhevm();
  const { encrypt, isEncrypting } = useEncrypt();
  const { verifyDecryption, isDecrypting: fheIsDecrypting } = useDecrypt();

  useEffect(() => {
    const initFhevmAfterConnection = async () => {
      if (!isConnected || isInitialized || fhevmInitializing) return;
      
      try {
        setFhevmInitializing(true);
        await initialize();
      } catch (error) {
        setTransactionStatus({ 
          visible: true, 
          status: "error", 
          message: "FHEVM initialization failed" 
        });
        setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      } finally {
        setFhevmInitializing(false);
      }
    };

    initFhevmAfterConnection();
  }, [isConnected, isInitialized, initialize, fhevmInitializing]);

  useEffect(() => {
    const loadDataAndContract = async () => {
      if (!isConnected) {
        setLoading(false);
        return;
      }
      
      try {
        await loadData();
        const contract = await getContractReadOnly();
        if (contract) setContractAddress(await contract.getAddress());
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDataAndContract();
  }, [isConnected]);

  const loadData = async () => {
    if (!isConnected) return;
    
    setIsRefreshing(true);
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      const businessIds = await contract.getAllBusinessIds();
      const warningsList: WarningData[] = [];
      
      for (const businessId of businessIds) {
        try {
          const businessData = await contract.getBusinessData(businessId);
          warningsList.push({
            id: businessId,
            name: businessData.name,
            locationIndex: Number(businessData.publicValue1) || 0,
            severity: Number(businessData.publicValue2) || 0,
            timestamp: Number(businessData.timestamp),
            creator: businessData.creator,
            publicValue1: Number(businessData.publicValue1) || 0,
            publicValue2: Number(businessData.publicValue2) || 0,
            isVerified: businessData.isVerified,
            decryptedValue: Number(businessData.decryptedValue) || 0
          });
        } catch (e) {
          console.error('Error loading business data:', e);
        }
      }
      
      setWarnings(warningsList);
    } catch (e) {
      setTransactionStatus({ visible: true, status: "error", message: "Failed to load data" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    } finally { 
      setIsRefreshing(false); 
    }
  };

  const createWarning = async () => {
    if (!isConnected || !address) { 
      setTransactionStatus({ visible: true, status: "error", message: "Please connect wallet first" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return; 
    }
    
    setCreatingWarning(true);
    setTransactionStatus({ visible: true, status: "pending", message: "Creating warning with Zama FHE..." });
    
    try {
      const contract = await getContractWithSigner();
      if (!contract) throw new Error("Failed to get contract with signer");
      
      const locationValue = parseInt(newWarningData.locationIndex) || 0;
      const businessId = `warning-${Date.now()}`;
      
      const encryptedResult = await encrypt(contractAddress, address, locationValue);
      
      const tx = await contract.createBusinessData(
        businessId,
        newWarningData.name,
        encryptedResult.encryptedData,
        encryptedResult.proof,
        locationValue,
        parseInt(newWarningData.severity) || 0,
        "Disaster Warning Alert"
      );
      
      setTransactionStatus({ visible: true, status: "pending", message: "Waiting for transaction confirmation..." });
      await tx.wait();
      
      setTransactionStatus({ visible: true, status: "success", message: "Warning created successfully!" });
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 2000);
      
      await loadData();
      setShowCreateModal(false);
      setNewWarningData({ name: "", locationIndex: "", severity: "" });
    } catch (e: any) {
      const errorMessage = e.message?.includes("user rejected transaction") 
        ? "Transaction rejected by user" 
        : "Submission failed: " + (e.message || "Unknown error");
      setTransactionStatus({ visible: true, status: "error", message: errorMessage });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    } finally { 
      setCreatingWarning(false); 
    }
  };

  const decryptData = async (businessId: string): Promise<number | null> => {
    if (!isConnected || !address) { 
      setTransactionStatus({ visible: true, status: "error", message: "Please connect wallet first" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return null; 
    }
    
    setIsDecrypting(true);
    try {
      const contractRead = await getContractReadOnly();
      if (!contractRead) return null;
      
      const businessData = await contractRead.getBusinessData(businessId);
      if (businessData.isVerified) {
        const storedValue = Number(businessData.decryptedValue) || 0;
        
        setTransactionStatus({ 
          visible: true, 
          status: "success", 
          message: "Data already verified on-chain" 
        });
        setTimeout(() => {
          setTransactionStatus({ visible: false, status: "pending", message: "" });
        }, 2000);
        
        return storedValue;
      }
      
      const contractWrite = await getContractWithSigner();
      if (!contractWrite) return null;
      
      const encryptedValueHandle = await contractRead.getEncryptedValue(businessId);
      
      const result = await verifyDecryption(
        [encryptedValueHandle],
        contractAddress,
        (abiEncodedClearValues: string, decryptionProof: string) => 
          contractWrite.verifyDecryption(businessId, abiEncodedClearValues, decryptionProof)
      );
      
      setTransactionStatus({ visible: true, status: "pending", message: "Verifying decryption on-chain..." });
      
      const clearValue = result.decryptionResult.clearValues[encryptedValueHandle];
      
      await loadData();
      
      setTransactionStatus({ visible: true, status: "success", message: "Data decrypted and verified successfully!" });
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 2000);
      
      return Number(clearValue);
      
    } catch (e: any) { 
      if (e.message?.includes("Data already verified")) {
        setTransactionStatus({ 
          visible: true, 
          status: "success", 
          message: "Data is already verified on-chain" 
        });
        setTimeout(() => {
          setTransactionStatus({ visible: false, status: "pending", message: "" });
        }, 2000);
        
        await loadData();
        return null;
      }
      
      setTransactionStatus({ 
        visible: true, 
        status: "error", 
        message: "Decryption failed: " + (e.message || "Unknown error") 
      });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return null; 
    } finally { 
      setIsDecrypting(false); 
    }
  };

  const checkAvailability = async () => {
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      const available = await contract.isAvailable();
      setTransactionStatus({ 
        visible: true, 
        status: "success", 
        message: "Contract is available and ready" 
      });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 2000);
    } catch (e) {
      setTransactionStatus({ visible: true, status: "error", message: "Availability check failed" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    }
  };

  const filteredWarnings = warnings.filter(warning => {
    const matchesSearch = warning.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSeverity = filterSeverity === "all" || warning.severity.toString() === filterSeverity;
    return matchesSearch && matchesSeverity;
  });

  const stats = {
    total: warnings.length,
    verified: warnings.filter(w => w.isVerified).length,
    highSeverity: warnings.filter(w => w.severity >= 7).length,
    recent: warnings.filter(w => Date.now()/1000 - w.timestamp < 86400).length
  };

  if (!isConnected) {
    return (
      <div className="app-container">
        <header className="app-header">
          <div className="logo">
            <h1>🌪️ Private Disaster Warning</h1>
          </div>
          <div className="header-actions">
            <ConnectButton accountStatus="address" chainStatus="icon" showBalance={false}/>
          </div>
        </header>
        
        <div className="connection-prompt">
          <div className="connection-content">
            <div className="connection-icon">🔐</div>
            <h2>Connect Wallet to Access Encrypted Alerts</h2>
            <p>Secure, privacy-preserving disaster warnings using Zama FHE technology</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isInitialized || fhevmInitializing) {
    return (
      <div className="loading-screen">
        <div className="fhe-spinner"></div>
        <p>Initializing FHE Encryption System...</p>
      </div>
    );
  }

  if (loading) return (
    <div className="loading-screen">
      <div className="fhe-spinner"></div>
      <p>Loading encrypted warning system...</p>
    </div>
  );

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="logo">
          <h1>🌪️ Private Disaster Warning</h1>
          <span>FHE-Protected Location Alerts</span>
        </div>
        
        <div className="header-actions">
          <button onClick={checkAvailability} className="availability-btn">
            Check System
          </button>
          <button onClick={() => setShowCreateModal(true)} className="create-btn">
            + New Warning
          </button>
          <ConnectButton accountStatus="address" chainStatus="icon" showBalance={false}/>
        </div>
      </header>
      
      <div className="main-content">
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">Total Warnings</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.verified}</div>
            <div className="stat-label">Verified</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.highSeverity}</div>
            <div className="stat-label">High Severity</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.recent}</div>
            <div className="stat-label">Last 24h</div>
          </div>
        </div>

        <div className="controls-section">
          <div className="search-filter">
            <input
              type="text"
              placeholder="Search warnings..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
            <select 
              value={filterSeverity} 
              onChange={(e) => setFilterSeverity(e.target.value)}
              className="severity-filter"
            >
              <option value="all">All Severity</option>
              <option value="1">Level 1</option>
              <option value="2">Level 2</option>
              <option value="3">Level 3</option>
              <option value="4">Level 4</option>
              <option value="5">Level 5</option>
            </select>
            <button onClick={loadData} disabled={isRefreshing} className="refresh-btn">
              {isRefreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        <div className="warnings-list">
          {filteredWarnings.length === 0 ? (
            <div className="no-warnings">
              <p>No warnings found</p>
              <button onClick={() => setShowCreateModal(true)} className="create-btn">
                Create First Warning
              </button>
            </div>
          ) : (
            filteredWarnings.map((warning, index) => (
              <div 
                key={index}
                className={`warning-item ${warning.isVerified ? 'verified' : ''} severity-${warning.severity}`}
                onClick={() => setSelectedWarning(warning)}
              >
                <div className="warning-header">
                  <h3>{warning.name}</h3>
                  <span className={`severity-badge level-${warning.severity}`}>
                    Level {warning.severity}
                  </span>
                </div>
                <div className="warning-details">
                  <span>Location Index: {warning.isVerified ? warning.decryptedValue : '🔒 Encrypted'}</span>
                  <span>{new Date(warning.timestamp * 1000).toLocaleString()}</span>
                </div>
                <div className="warning-status">
                  {warning.isVerified ? '✅ Verified' : '🔓 Ready for Verification'}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {showCreateModal && (
        <ModalCreateWarning 
          onSubmit={createWarning}
          onClose={() => setShowCreateModal(false)}
          creating={creatingWarning}
          warningData={newWarningData}
          setWarningData={setNewWarningData}
          isEncrypting={isEncrypting}
        />
      )}

      {selectedWarning && (
        <WarningDetailModal
          warning={selectedWarning}
          onClose={() => {
            setSelectedWarning(null);
            setDecryptedData(null);
          }}
          decryptedData={decryptedData}
          setDecryptedData={setDecryptedData}
          isDecrypting={isDecrypting || fheIsDecrypting}
          decryptData={() => decryptData(selectedWarning.id)}
        />
      )}

      {transactionStatus.visible && (
        <div className="transaction-modal">
          <div className="transaction-content">
            <div className={`transaction-icon ${transactionStatus.status}`}>
              {transactionStatus.status === "pending" && <div className="fhe-spinner"></div>}
              {transactionStatus.status === "success" && "✓"}
              {transactionStatus.status === "error" && "✗"}
            </div>
            <div className="transaction-message">{transactionStatus.message}</div>
          </div>
        </div>
      )}

      <footer className="app-footer">
        <div className="footer-content">
          <p>🔐 Powered by Zama FHE - Privacy-Preserving Disaster Alerts</p>
          <div className="footer-links">
            <span>位置索引加密</span>
            <span>推送邏輯同態</span>
            <span>應急管理</span>
            <span>公共安全</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

const ModalCreateWarning: React.FC<{
  onSubmit: () => void;
  onClose: () => void;
  creating: boolean;
  warningData: any;
  setWarningData: (data: any) => void;
  isEncrypting: boolean;
}> = ({ onSubmit, onClose, creating, warningData, setWarningData, isEncrypting }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setWarningData({ ...warningData, [name]: value });
  };

  return (
    <div className="modal-overlay">
      <div className="create-warning-modal">
        <div className="modal-header">
          <h2>Create New Warning</h2>
          <button onClick={onClose} className="close-modal">×</button>
        </div>
        
        <div className="modal-body">
          <div className="fhe-notice">
            <strong>FHE 🔐 Location Encryption</strong>
            <p>Location index will be encrypted with Zama FHE (Integer only)</p>
          </div>
          
          <div className="form-group">
            <label>Warning Name *</label>
            <input 
              type="text"
              name="name"
              value={warningData.name}
              onChange={handleChange}
              placeholder="Enter warning name..."
            />
          </div>
          
          <div className="form-group">
            <label>Location Index (Integer) *</label>
            <input 
              type="number"
              name="locationIndex"
              value={warningData.locationIndex}
              onChange={handleChange}
              placeholder="Enter location index..."
              min="0"
              step="1"
            />
            <div className="data-type-label">FHE Encrypted Integer</div>
          </div>
          
          <div className="form-group">
            <label>Severity Level *</label>
            <select name="severity" value={warningData.severity} onChange={handleChange}>
              <option value="">Select severity level</option>
              <option value="1">Level 1 - Low</option>
              <option value="2">Level 2 - Moderate</option>
              <option value="3">Level 3 - Significant</option>
              <option value="4">Level 4 - Severe</option>
              <option value="5">Level 5 - Extreme</option>
            </select>
            <div className="data-type-label">Public Data</div>
          </div>
        </div>
        
        <div className="modal-footer">
          <button onClick={onClose} className="cancel-btn">Cancel</button>
          <button 
            onClick={onSubmit}
            disabled={creating || isEncrypting || !warningData.name || !warningData.locationIndex || !warningData.severity}
            className="submit-btn"
          >
            {creating || isEncrypting ? "Encrypting..." : "Create Warning"}
          </button>
        </div>
      </div>
    </div>
  );
};

const WarningDetailModal: React.FC<{
  warning: WarningData;
  onClose: () => void;
  decryptedData: number | null;
  setDecryptedData: (value: number | null) => void;
  isDecrypting: boolean;
  decryptData: () => Promise<number | null>;
}> = ({ warning, onClose, decryptedData, setDecryptedData, isDecrypting, decryptData }) => {
  const handleDecrypt = async () => {
    if (decryptedData !== null) {
      setDecryptedData(null);
      return;
    }
    
    const decrypted = await decryptData();
    if (decrypted !== null) {
      setDecryptedData(decrypted);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="warning-detail-modal">
        <div className="modal-header">
          <h2>Warning Details</h2>
          <button onClick={onClose} className="close-modal">×</button>
        </div>
        
        <div className="modal-body">
          <div className="warning-info">
            <div className="info-row">
              <span>Warning Name:</span>
              <strong>{warning.name}</strong>
            </div>
            <div className="info-row">
              <span>Creator:</span>
              <strong>{warning.creator.substring(0, 8)}...{warning.creator.substring(36)}</strong>
            </div>
            <div className="info-row">
              <span>Created:</span>
              <strong>{new Date(warning.timestamp * 1000).toLocaleString()}</strong>
            </div>
            <div className="info-row">
              <span>Severity Level:</span>
              <strong className={`severity-${warning.severity}`}>Level {warning.severity}</strong>
            </div>
          </div>
          
          <div className="data-section">
            <h3>Encrypted Location Data</h3>
            <div className="encrypted-data">
              <div className="data-value">
                {warning.isVerified ? 
                  `${warning.decryptedValue} (Verified)` : 
                  decryptedData !== null ? 
                  `${decryptedData} (Decrypted)` : 
                  "🔒 FHE Encrypted"
                }
              </div>
              <button 
                className={`decrypt-btn ${warning.isVerified || decryptedData !== null ? 'decrypted' : ''}`}
                onClick={handleDecrypt}
                disabled={isDecrypting}
              >
                {isDecrypting ? "Decrypting..." : 
                 warning.isVerified ? "✅ Verified" :
                 decryptedData !== null ? "🔄 Re-verify" : "🔓 Verify"}
              </button>
            </div>
          </div>
          
          <div className="fhe-explanation">
            <h4>FHE Protection Process</h4>
            <div className="process-steps">
              <div className="step">1. Location Index Encrypted</div>
              <div className="step">2. Stored On-chain Securely</div>
              <div className="step">3. Offline Decryption</div>
              <div className="step">4. On-chain Verification</div>
            </div>
          </div>
        </div>
        
        <div className="modal-footer">
          <button onClick={onClose} className="close-btn">Close</button>
          {!warning.isVerified && (
            <button 
              onClick={handleDecrypt}
              disabled={isDecrypting}
              className="verify-btn"
            >
              {isDecrypting ? "Verifying..." : "Verify on-chain"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;



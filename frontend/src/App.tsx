import React, { useState, useEffect } from 'react';
import { Container, Nav, Navbar, Tab, Tabs, Alert, Button } from 'react-bootstrap';
import './App.css';
import TrialMatching from './components/trial-matching/TrialMatching';
import UserProfilePage from './components/profile/UserProfilePage';
import Debug from './components/Debug';
import 'bootstrap/dist/css/bootstrap.min.css';
import { UserProfile, defaultUserProfile } from './types/UserProfile';
import { checkApiHealth } from './services/api';

function App() {
  const [activeTab, setActiveTab] = useState<string>("profile");
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [profileComplete, setProfileComplete] = useState<boolean>(false);
  const [apiConnected, setApiConnected] = useState<boolean | null>(null);
  const [debugMode, setDebugMode] = useState<boolean>(false);
  
  // Check for debug mode in URL or localStorage - only on initial load
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('debug') === 'true') {
      setDebugMode(true);
      localStorage.setItem('debug', 'true');
    } else if (localStorage.getItem('debug') === 'true') {
      setDebugMode(true);
    }
  }, []);  // Empty dependency array ensures this only runs once

  // Check API health on component mount
  useEffect(() => {
    const checkBackendConnection = async () => {
      try {
        await checkApiHealth();
        setApiConnected(true);
      } catch (error) {
        console.error('API health check failed:', error);
        setApiConnected(false);
      }
    };
    
    checkBackendConnection();
  }, []);  // Empty dependency array ensures this only runs once

  // Load profile on component mount
  useEffect(() => {
    const loadProfile = () => {
      const savedProfile = localStorage.getItem('userProfile');
      if (savedProfile) {
        try {
          const profile = JSON.parse(savedProfile);
          setUserProfile(profile);
          
          // Check if profile is complete (has required fields)
          const isComplete = Boolean(
            profile.firstName && 
            profile.lastName && 
            profile.age > 0 &&
            profile.location && 
            profile.medicalConditions.length > 0 &&
            profile.contactEmail
          );
          
          setProfileComplete(isComplete);
          
          // If profile is complete or we're in debug mode, navigate to trial matching tab
          if (isComplete || debugMode) {
            setActiveTab('match');
          }
        } catch (e) {
          console.error('Failed to parse saved profile:', e);
        }
      }
    };
    
    loadProfile();
  }, [debugMode]);  // Only reload when debug mode changes

  // Handle profile saving
  const handleProfileUpdate = (profile: UserProfile) => {
    setUserProfile(profile);
    
    // Check if profile is complete
    const isComplete = Boolean(
      profile.firstName && 
      profile.lastName && 
      profile.age > 0 &&
      profile.location && 
      profile.medicalConditions.length > 0 &&
      profile.contactEmail
    );
    
    setProfileComplete(isComplete);
    localStorage.setItem('userProfile', JSON.stringify(profile));
    
    // If profile is now complete, navigate to matching tab
    if (isComplete) {
      setActiveTab('match');
    }
  };
  
  const clearProfile = () => {
    if (window.confirm('Are you sure you want to clear your profile data?')) {
      localStorage.removeItem('userProfile');
      setUserProfile(defaultUserProfile);
      setProfileComplete(false);
      setActiveTab('profile');
    }
  };
  
  const toggleDebugMode = () => {
    const newMode = !debugMode;
    setDebugMode(newMode);
    if (newMode) {
      localStorage.setItem('debug', 'true');
    } else {
      localStorage.removeItem('debug');
    }
  };

  return (
    <div className="App">
      <Navbar bg="dark" variant="dark" expand="lg">
        <Container>
          <Navbar.Brand>ClinCrush</Navbar.Brand>
          <Navbar.Toggle aria-controls="basic-navbar-nav" />
          <Navbar.Collapse id="basic-navbar-nav">
            <Nav className="me-auto">
              <Nav.Link 
                onClick={() => setActiveTab('match')} 
                disabled={!profileComplete && !debugMode}
              >
                Trial Matching
              </Nav.Link>
              <Nav.Link 
                onClick={() => setActiveTab('matches')}
                disabled={!profileComplete && !debugMode}
              >
                My Matches
              </Nav.Link>
              <Nav.Link onClick={() => setActiveTab('profile')}>
                My Profile
              </Nav.Link>
            </Nav>
            
            <div className="d-flex align-items-center">
              {debugMode && (
                <span className="badge bg-warning text-dark me-3">Debug Mode</span>
              )}
              
              {apiConnected === false && (
                <span className="text-danger me-3">⚠️ Backend disconnected</span>
              )}
              {apiConnected === true && (
                <span className="text-success me-3">✓ Connected</span>
              )}
              
              <Button 
                size="sm" 
                variant={debugMode ? "outline-warning" : "outline-light"} 
                onClick={toggleDebugMode}
              >
                {debugMode ? 'Disable Debug' : 'Enable Debug'}
              </Button>
            </div>
          </Navbar.Collapse>
        </Container>
      </Navbar>
      
      <Container className="mt-4">
        {!profileComplete && !debugMode && (
          <Alert variant="info" className="mb-4">
            <Alert.Heading>Welcome to ClinCrush!</Alert.Heading>
            <p>
              Please complete your health profile to find clinical trials that match your needs.
              Once your profile is complete, we'll show you personalized trial recommendations.
            </p>
          </Alert>
        )}
        
        <Tabs 
          activeKey={activeTab} 
          onSelect={(k) => k && setActiveTab(k)}
          id="main-tabs" 
          className="mb-4"
        >
          <Tab eventKey="match" title="Trial Matching" disabled={!profileComplete && !debugMode}>
            {(profileComplete || debugMode) ? (
              <TrialMatching 
                userProfile={userProfile || defaultUserProfile} 
                debug={debugMode} 
              />
            ) : (
              <div className="p-5 text-center">
                <h3>Profile Required</h3>
                <p>You need to complete your profile before viewing matching trials.</p>
              </div>
            )}
          </Tab>
          <Tab eventKey="matches" title="My Matches" disabled={!profileComplete && !debugMode}>
            <div className="p-4 text-center">
              <h3>My Matched Trials</h3>
              <p>This tab will show trials you've matched with.</p>
            </div>
          </Tab>
          <Tab eventKey="profile" title="My Profile">
            <UserProfilePage 
              initialProfile={userProfile || defaultUserProfile} 
              onProfileUpdate={handleProfileUpdate}
            />
            
            {userProfile && (
              <div className="d-flex justify-content-center mt-4">
                <Button 
                  variant="outline-danger" 
                  onClick={clearProfile}
                  className="mx-2"
                >
                  Clear Profile Data
                </Button>
              </div>
            )}
            
            {debugMode && userProfile && (
              <Debug 
                data={userProfile} 
                title="Profile Data"
                expanded={true}
              />
            )}
          </Tab>
        </Tabs>
      </Container>
    </div>
  );
}

export default App;
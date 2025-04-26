import React, { useEffect, useState } from 'react';
import { Container, Row, Col, Spinner, Alert, Button } from 'react-bootstrap';
import { searchTrials } from '../../services/api';
import TrialCard from './TrialCard';
import { UserProfile } from '../../types/UserProfile';
import { rankTrialsByMatchScore } from '../../utils/matchingAlgorithm';
import './TrialMatching.css';
import Debug from '../Debug';

interface TrialMatchingProps {
  userProfile: UserProfile;
  debug?: boolean;
}

const TrialMatching: React.FC<TrialMatchingProps> = ({ userProfile, debug = false }) => {
  const [trials, setTrials] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [matchedTrials, setMatchedTrials] = useState<any[]>([]);
  const [rejectedTrials, setRejectedTrials] = useState<any[]>([]);
  
  // Load trials based on user profile
  useEffect(() => {
    const loadTrials = async () => {
      if (userProfile && userProfile.medicalConditions.length > 0) {
        setLoading(true);
        setError(null);
        
        try {
          // Use the first condition for searching
          const condition = userProfile.medicalConditions[0];
          // Extract city from location
          const city = userProfile.location.split(',')[0].trim();
          
          console.log(`Searching for trials with condition: ${condition}, location: ${city}`);
          
          const trialsData = await searchTrials(condition, city);
          
          if (Array.isArray(trialsData) && trialsData.length > 0) {
            console.log(`Received ${trialsData.length} trials from API`);
            
            // Rank trials by match score
            const rankedTrials = rankTrialsByMatchScore(trialsData, userProfile);
            console.log(`Ranked ${rankedTrials.length} trials`);
            
            setTrials(rankedTrials);
            setCurrentIndex(0);
            setMatchedTrials([]);
            setRejectedTrials([]);
          } else {
            console.error('No trials returned from API or invalid response format', trialsData);
            setError('No clinical trials found matching your criteria.');
            setTrials([]);
          }
        } catch (err) {
          console.error('Error loading trials:', err);
          setError('Failed to load clinical trials. Please try again later.');
          setTrials([]);
        } finally {
          setLoading(false);
        }
      } else {
        setError('Your profile is missing medical conditions. Please update your profile.');
        setLoading(false);
      }
    };

    loadTrials();
  }, [userProfile]);

  const handleSwipeLeft = () => {
    if (currentIndex < trials.length) {
      setRejectedTrials([...rejectedTrials, trials[currentIndex]]);
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleSwipeRight = () => {
    if (currentIndex < trials.length) {
      setMatchedTrials([...matchedTrials, trials[currentIndex]]);
      setCurrentIndex(currentIndex + 1);
      
      // Save matched trials to localStorage
      const savedMatches = JSON.parse(localStorage.getItem('matchedTrials') || '[]');
      localStorage.setItem('matchedTrials', JSON.stringify([...savedMatches, trials[currentIndex]]));
    }
  };

  const handleShowDetails = () => {
    if (currentIndex < trials.length) {
      const trial = trials[currentIndex];
      
      // Format compensation info
      const compensationInfo = trial.compensation?.has_compensation 
        ? `Compensation: ${trial.compensation.amount ? '$' + trial.compensation.amount : 'Available'}` 
        : 'No compensation offered';
      
      // Display more comprehensive information
      const locations = trial.locations.map((loc: any) => 
        `${loc.facility || 'Unknown facility'}, ${loc.city || ''}, ${loc.state || ''}, ${loc.country || ''}${loc.distance ? ` (${loc.distance} miles)` : ''}`
      ).join('\n');
      
      alert(
        `${trial.title}\n\n` +
        `ID: ${trial.id}\n\n` +
        `Match Score: ${Math.round((trial.matchScore || 0) * 100)}%\n\n` +
        `${compensationInfo}\n\n` +
        `Conditions: ${trial.conditions ? trial.conditions.join(', ') : 'Not specified'}\n\n` +
        `Gender: ${trial.gender || 'Not specified'}\n` +
        `Age Range: ${trial.age_range?.min || 'Any'} - ${trial.age_range?.max || 'Any'}\n\n` +
        `Locations:\n${locations}\n\n` +
        `Summary:\n${trial.summary || 'No summary available'}`
      );
    }
  };

  return (
    <Container>
      <Row className="my-4">
        <Col>
          <h2 className="text-center mb-4">Your Matching Clinical Trials</h2>
          
          {loading && (
            <div className="text-center my-5">
              <Spinner animation="border" role="status">
                <span className="visually-hidden">Loading...</span>
              </Spinner>
              <p className="mt-2">Finding trials that match your profile...</p>
            </div>
          )}
          
          {error && (
            <Alert variant="danger">{error}</Alert>
          )}
          
          {!loading && !error && trials.length > 0 && currentIndex < trials.length && (
            <div className="trial-swipe-container">
              <TrialCard
                trial={trials[currentIndex]}
                onSwipeLeft={handleSwipeLeft}
                onSwipeRight={handleSwipeRight}
                onShowDetails={handleShowDetails}
                userProfile={userProfile}
              />
              
              <div className="text-center mt-3">
                <p className="text-muted">Swipe left to pass, right to save this trial</p>
              </div>
            </div>
          )}
          
          {!loading && !error && trials.length > 0 && currentIndex >= trials.length && (
            <div className="text-center my-5">
              <h3>You've viewed all available trials!</h3>
              <p>You matched with {matchedTrials.length} trials.</p>
              <Button variant="primary" onClick={() => window.location.href = '#matches'}>
                View My Matches
              </Button>
            </div>
          )}
          
          {!loading && !error && trials.length === 0 && (
            <Alert variant="warning">
              <Alert.Heading>No Matching Trials Found</Alert.Heading>
              <p>
                We couldn't find any clinical trials that match your profile. Try updating your profile
                with different medical conditions or increasing your maximum travel distance.
              </p>
            </Alert>
          )}
          
          {!loading && !error && trials.length > 0 && (
            <div className="stats-container text-center mt-3">
              <p>Viewed: {currentIndex} | Matched: {matchedTrials.length} | Passed: {rejectedTrials.length}</p>
            </div>
          )}
        </Col>
      </Row>
      {debug && (
        <Debug 
          data={{
            userProfile,
            currentTrial: trials[currentIndex] || 'No current trial',
            totalTrials: trials.length,
            currentIndex,
            matchedCount: matchedTrials.length,
            rejectedCount: rejectedTrials.length
          }}
          title="Trial Matching Debug"
        />
      )}
    </Container>
  );
};

export default TrialMatching;
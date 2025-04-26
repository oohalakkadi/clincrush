// src/components/trial-matching/TrialMatching.tsx
import React, { useEffect, useState, useRef } from 'react';
import { Container, Row, Col, Spinner, Alert, Button } from 'react-bootstrap';
import { searchTrials } from '../../services/api';
import TrialCard from './TrialCard';
import { UserProfile } from '../../types/UserProfile';
import { rankTrialsByMatchScore } from '../../utils/matchingAlgorithm';
import Debug from '../Debug';
import './TrialMatching.css';

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
  
  // Use a ref to track if the component is mounted
  const isMountedRef = useRef<boolean>(true);
  // Use a ref to track if a data fetch is in progress
  const isFetchingRef = useRef<boolean>(false);
  // Track the profile that we've already searched for
  const searchedProfileRef = useRef<string | null>(null);
  
  // Check if the component is mounted
  useEffect(() => {
    return () => {
      // Set to false when component unmounts
      isMountedRef.current = false;
    };
  }, []);
  
  // Load trials based on user profile
  useEffect(() => {
    const loadTrials = async () => {
      // Skip if we're already fetching or the component is not mounted
      if (isFetchingRef.current || !isMountedRef.current) {
        return;
      }
      
      // Skip if the profile hasn't changed or is invalid
      const profileKey = JSON.stringify({
        conditions: userProfile.medicalConditions,
        location: userProfile.location,
        allergies: userProfile.allergies,
        maxDistance: userProfile.maxTravelDistance
      });
      
      if (profileKey === searchedProfileRef.current) {
        console.log('Profile unchanged, skipping search');
        return;
      }
      
      if (!userProfile || !userProfile.medicalConditions || userProfile.medicalConditions.length === 0) {
        setError('Your profile is missing medical conditions. Please update your profile.');
        setLoading(false);
        return;
      }
      
      if (!userProfile.location) {
        setError('Your profile is missing location information. Please update your profile.');
        setLoading(false);
        return;
      }

      try {
        isFetchingRef.current = true;
        setLoading(true);
        setError(null);
        
        // Use the first condition for searching
        const condition = userProfile.medicalConditions[0];
        // Extract city from location
        const city = userProfile.location.split(',')[0].trim();
        
        console.log(`Searching for trials with condition: ${condition}, location: ${city}, max distance: ${userProfile.maxTravelDistance} miles`);
        
        // Pass the user's max travel distance to the API
        const trialsData = await searchTrials(condition, city, {
          distance: userProfile.maxTravelDistance,
          max_results: 30
        });
        
        // Skip further processing if component unmounted during API call
        if (!isMountedRef.current) return;
        
        if (Array.isArray(trialsData) && trialsData.length > 0) {
          console.log(`Received ${trialsData.length} trials from API`);
          
          // Further filter and rank trials based on allergies and other criteria
          const rankedTrials = rankTrialsByMatchScore(trialsData, userProfile);
          console.log(`Ranked ${rankedTrials.length} trials`);
          
          setTrials(rankedTrials);
          setCurrentIndex(0);
          setMatchedTrials([]);
          setRejectedTrials([]);
          
          // Remember this profile
          searchedProfileRef.current = profileKey;
        } else {
          console.error('No trials returned from API or invalid response format', trialsData);
          setError('No clinical trials found matching your criteria.');
          setTrials([]);
        }
      } catch (err) {
        if (isMountedRef.current) {
          console.error('Error loading trials:', err);
          setError('Failed to load clinical trials. Please try again later.');
          setTrials([]);
        }
      } finally {
        isFetchingRef.current = false;
        setLoading(false);
      }
    };

    loadTrials();
  }, [userProfile.medicalConditions, userProfile.location, userProfile.allergies, userProfile.maxTravelDistance]);

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
  
  // Handler to load more trials if needed
  const loadMoreTrials = async () => {
    if (userProfile && userProfile.medicalConditions.length > 0) {
      try {
        // Use the second condition if available, or first one again
        const conditionIndex = matchedTrials.length > 0 ? 1 : 0;
        const condition = userProfile.medicalConditions[conditionIndex] || userProfile.medicalConditions[0];
        
        setLoading(true);
        
        const moreTrials = await searchTrials(condition, userProfile.location, {
          distance: userProfile.maxTravelDistance,
          max_results: 20
        });
        
        if (Array.isArray(moreTrials) && moreTrials.length > 0) {
          // Filter out trials we've already seen
          const existingIds = new Set(trials.map(t => t.id));
          const newTrials = moreTrials.filter(t => !existingIds.has(t.id));
          
          if (newTrials.length > 0) {
            // Rank the new trials
            const rankedNewTrials = rankTrialsByMatchScore(newTrials, userProfile);
            
            // Add to existing trials
            setTrials([...trials, ...rankedNewTrials]);
          } else {
            setError('No more trials found matching your criteria.');
          }
        }
      } catch (err) {
        console.error('Error loading more trials:', err);
      } finally {
        setLoading(false);
      }
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
                <p className="text-muted">
                  Swipe left to pass, right to save this trial. 
                  {currentIndex + 1} of {trials.length} trials.
                </p>
              </div>
            </div>
          )}
          
          {!loading && !error && trials.length > 0 && currentIndex >= trials.length && (
            <div className="text-center my-5">
              <h3>You've viewed all available trials!</h3>
              <p>You matched with {matchedTrials.length} trials.</p>
              <div className="d-flex justify-content-center">
                <Button variant="primary" className="me-3" onClick={() => window.location.href = '#matches'}>
                  View My Matches
                </Button>
                <Button variant="secondary" onClick={loadMoreTrials}>
                  Load More Trials
                </Button>
              </div>
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
          
          {debug && (
            <Debug 
              data={{
                userProfile,
                currentTrial: trials[currentIndex] || 'No current trial',
                totalTrials: trials.length,
                currentIndex,
                matchedCount: matchedTrials.length,
                rejectedCount: rejectedTrials.length,
                isFetching: isFetchingRef.current
              }}
              title="Trial Matching Debug"
            />
          )}
        </Col>
      </Row>
    </Container>
  );
};

export default TrialMatching;
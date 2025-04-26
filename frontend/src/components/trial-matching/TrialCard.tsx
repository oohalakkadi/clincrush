import React from 'react';
import { Card, Button, Badge } from 'react-bootstrap';
import { UserProfile } from '../../types/UserProfile';
import './TrialCard.css';

interface TrialCardProps {
  trial: any;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  onShowDetails: () => void;
  userProfile: UserProfile;
}

const TrialCard: React.FC<TrialCardProps> = ({
  trial,
  onSwipeLeft,
  onSwipeRight,
  onShowDetails,
  userProfile
}) => {
  // Format match score percentage
  const matchPercentage = Math.round((trial.matchScore || 0) * 100);
  
  // Find the closest location
  const closestLocation = trial.locations && trial.locations.length > 0 
    ? trial.locations.reduce((closest: any, current: any) => {
        if (!closest || (current.distance !== undefined && current.distance < closest.distance)) {
          return current;
        }
        return closest;
      }, null)
    : null;
  
  const formatDistance = (distance?: number): string => {
    if (distance === undefined) return 'Unknown distance';
    return `${distance} ${distance === 1 ? 'mile' : 'miles'} away`;
  };
  
  // Format location string
  const locationText = closestLocation 
    ? `${closestLocation.city || ''}, ${closestLocation.state || ''} ${closestLocation.distance !== undefined ? `- ${formatDistance(closestLocation.distance)}` : ''}`
    : 'Location information not available';
  
  // Format compensation data
  const compensationBadge = trial.compensation?.has_compensation ? (
    <Badge bg="success" className="ms-2">
      {trial.compensation.amount ? `$${trial.compensation.amount}` : 'Paid'}
    </Badge>
  ) : (
    <Badge bg="secondary" className="ms-2">No Payment</Badge>
  );
  
  // Format gender badge
  const formatGender = () => {
    if (!trial.gender) return null;
    
    // Clean up the gender display
    const normalizedGender = trial.gender.toLowerCase();
    
    if (normalizedGender === 'all' || normalizedGender.includes('both')) {
      return <Badge bg="info" className="me-1">All Genders</Badge>;
    } else if (normalizedGender.includes('male') && normalizedGender.includes('female')) {
      return <Badge bg="info" className="me-1">All Genders</Badge>;
    } else if (normalizedGender.includes('male')) {
      return <Badge bg="info" className="me-1">Male</Badge>;
    } else if (normalizedGender.includes('female')) {
      return <Badge bg="info" className="me-1">Female</Badge>;
    }
    
    return null;
  };

  return (
    <Card className="trial-card">
      <Card.Header className="d-flex justify-content-between align-items-center">
        <div className="match-score">
          <Badge bg={matchPercentage > 80 ? "success" : matchPercentage > 60 ? "warning" : "danger"}>
            {matchPercentage}% Match
          </Badge>
          {compensationBadge}
        </div>
      </Card.Header>
      <Card.Body>
        <Card.Title>{trial.title}</Card.Title>
        <Card.Subtitle className="mb-2 text-muted">
          {locationText}
        </Card.Subtitle>
        
        <div className="trial-tags mb-3">
          {trial.conditions && trial.conditions.slice(0, 3).map((condition: string, index: number) => (
            <Badge bg="primary" className="me-1" key={index}>{condition}</Badge>
          ))}
          {formatGender()}
        </div>
        
        <Card.Text className="trial-summary">
          {trial.summary && trial.summary.length > 200 
            ? trial.summary.substring(0, 200) + '...' 
            : trial.summary || 'No summary available'}
        </Card.Text>
        
        {trial.compensation?.has_compensation && (
          <div className="compensation-info mt-2 p-2 bg-light rounded">
            <strong>Compensation:</strong> {trial.compensation.amount ? `$${trial.compensation.amount}` : 'Available'} 
            {trial.compensation.details && (
              <p className="small mt-1 mb-0">{trial.compensation.details}</p>
            )}
          </div>
        )}
      </Card.Body>
      <Card.Footer className="text-center">
        <div className="d-flex justify-content-between">
          <Button 
            variant="outline-danger" 
            onClick={onSwipeLeft}
            className="swipe-button"
          >
            Not Interested
          </Button>
          <Button 
            variant="outline-secondary" 
            onClick={onShowDetails}
            className="swipe-button mx-2"
          >
            Details
          </Button>
          <Button 
            variant="outline-success" 
            onClick={onSwipeRight}
            className="swipe-button"
          >
            Interested
          </Button>
        </div>
      </Card.Footer>
    </Card>
  );
};

export default TrialCard;
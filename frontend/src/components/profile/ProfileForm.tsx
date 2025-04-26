// Update the ProfileForm component to include common allergens and preferred compensation
import React, { useState } from 'react';
import { Form, Button, Row, Col, Card, Badge, Alert } from 'react-bootstrap';
import { UserProfile } from '../../types/UserProfile';

interface ProfileFormProps {
  initialProfile: UserProfile;
  onSave: (profile: UserProfile) => void;
  isSaving?: boolean;
}

const ProfileForm: React.FC<ProfileFormProps> = ({ 
  initialProfile, 
  onSave,
  isSaving = false
}) => {
  const [profile, setProfile] = useState<UserProfile>(initialProfile);
  const [newCondition, setNewCondition] = useState<string>('');
  const [newMedication, setNewMedication] = useState<string>('');
  const [newAllergy, setNewAllergy] = useState<string>('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Common allergens for quick selection
  const commonAllergens = [
    'Penicillin', 'Ibuprofen', 'Aspirin', 'Latex', 'Peanuts', 
    'Shellfish', 'Eggs', 'Dairy', 'Soy', 'Wheat', 'Tree Nuts', 'Sulfonamides'
  ];

  // Common conditions for suggestions
  const commonConditions = [
    'Diabetes', 'High Blood Pressure', 'Asthma', 'Cancer', 'Depression',
    'Anxiety', 'Heart Disease', 'Arthritis', 'COPD', 'Obesity'
  ];

  // Check if all required fields are filled
  const isProfileComplete = Boolean(
    profile.firstName && 
    profile.lastName && 
    profile.age > 0 &&
    profile.location && 
    profile.medicalConditions.length > 0
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setProfile({ ...profile, [name]: value });
    
    // Clear validation error when field is modified
    if (validationErrors[name]) {
      const newErrors = { ...validationErrors };
      delete newErrors[name];
      setValidationErrors(newErrors);
    }
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const numValue = parseInt(value) || 0;
    setProfile({ ...profile, [name]: numValue });
    
    // Clear validation error when field is modified
    if (validationErrors[name]) {
      const newErrors = { ...validationErrors };
      delete newErrors[name];
      setValidationErrors(newErrors);
    }
  };

  const handleGenderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setProfile({ ...profile, gender: e.target.value as 'Male' | 'Female' | 'Other' });
  };

  const addCondition = () => {
    if (newCondition.trim()) {
      setProfile({
        ...profile,
        medicalConditions: [...profile.medicalConditions, newCondition.trim()]
      });
      setNewCondition('');
      
      // Clear validation error for medicalConditions
      if (validationErrors.medicalConditions) {
        const newErrors = { ...validationErrors };
        delete newErrors.medicalConditions;
        setValidationErrors(newErrors);
      }
    }
  };

  const addCommonCondition = (condition: string) => {
    if (!profile.medicalConditions.includes(condition)) {
      setProfile({
        ...profile,
        medicalConditions: [...profile.medicalConditions, condition]
      });
      
      // Clear validation error for medicalConditions
      if (validationErrors.medicalConditions) {
        const newErrors = { ...validationErrors };
        delete newErrors.medicalConditions;
        setValidationErrors(newErrors);
      }
    }
  };

  const removeCondition = (index: number) => {
    const updatedConditions = [...profile.medicalConditions];
    updatedConditions.splice(index, 1);
    setProfile({ ...profile, medicalConditions: updatedConditions });
  };

  const addMedication = () => {
    if (newMedication.trim()) {
      setProfile({
        ...profile,
        medications: [...profile.medications, newMedication.trim()]
      });
      setNewMedication('');
    }
  };

  const removeMedication = (index: number) => {
    const updatedMedications = [...profile.medications];
    updatedMedications.splice(index, 1);
    setProfile({ ...profile, medications: updatedMedications });
  };

  const addAllergy = () => {
    if (newAllergy.trim()) {
      setProfile({
        ...profile,
        allergies: [...profile.allergies, newAllergy.trim()]
      });
      setNewAllergy('');
    }
  };

  const removeAllergy = (index: number) => {
    const updatedAllergies = [...profile.allergies];
    updatedAllergies.splice(index, 1);
    setProfile({ ...profile, allergies: updatedAllergies });
  };

  const addCommonAllergen = (allergen: string) => {
    if (!profile.allergies.includes(allergen)) {
      setProfile({
        ...profile,
        allergies: [...profile.allergies, allergen]
      });
    }
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    if (!profile.firstName) errors.firstName = "First name is required";
    if (!profile.lastName) errors.lastName = "Last name is required";
    if (!profile.age || profile.age <= 0) errors.age = "Valid age is required";
    if (!profile.location) errors.location = "Location is required";
    if (profile.medicalConditions.length === 0) errors.medicalConditions = "At least one medical condition is required";
    if (!profile.contactEmail) errors.contactEmail = "Email is required";
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form before saving
    if (validateForm()) {
      onSave(profile);
    }
  };

  return (
    <Form onSubmit={handleSubmit}>
      {!isProfileComplete && (
        <Alert variant="info" className="mb-4">
          <Alert.Heading>Complete Your Profile</Alert.Heading>
          <p>
            To help us find the best clinical trial matches for you, please complete all required fields
            marked with <span className="text-danger">*</span>.
          </p>
        </Alert>
      )}

      <Card className="mb-4">
        <Card.Header>
          <h4>Personal Information</h4>
        </Card.Header>
        <Card.Body>
          <Row>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>
                  First Name <span className="text-danger">*</span>
                </Form.Label>
                <Form.Control
                  type="text"
                  name="firstName"
                  value={profile.firstName}
                  onChange={handleInputChange}
                  isInvalid={!!validationErrors.firstName}
                  required
                />
                <Form.Control.Feedback type="invalid">
                  {validationErrors.firstName}
                </Form.Control.Feedback>
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>
                  Last Name <span className="text-danger">*</span>
                </Form.Label>
                <Form.Control
                  type="text"
                  name="lastName"
                  value={profile.lastName}
                  onChange={handleInputChange}
                  isInvalid={!!validationErrors.lastName}
                  required
                />
                <Form.Control.Feedback type="invalid">
                  {validationErrors.lastName}
                </Form.Control.Feedback>
              </Form.Group>
            </Col>
          </Row>
          <Row>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>
                  Age <span className="text-danger">*</span>
                </Form.Label>
                <Form.Control
                  type="number"
                  name="age"
                  value={profile.age || ''}
                  onChange={handleNumberChange}
                  isInvalid={!!validationErrors.age}
                  required
                  min="1"
                  max="120"
                />
                <Form.Control.Feedback type="invalid">
                  {validationErrors.age}
                </Form.Control.Feedback>
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>
                  Gender <span className="text-danger">*</span>
                </Form.Label>
                <Form.Select 
                  name="gender" 
                  value={profile.gender} 
                  onChange={handleGenderChange}
                  required
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other/Prefer not to say</option>
                </Form.Select>
              </Form.Group>
            </Col>
          </Row>
          <Row>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>
                  Location (City, State) <span className="text-danger">*</span>
                </Form.Label>
                <Form.Control
                  type="text"
                  name="location"
                  value={profile.location}
                  onChange={handleInputChange}
                  placeholder="e.g. Boston, MA"
                  isInvalid={!!validationErrors.location}
                  required
                />
                <Form.Control.Feedback type="invalid">
                  {validationErrors.location}
                </Form.Control.Feedback>
                <Form.Text className="text-muted">
                  Enter your city and state to find nearby trials
                </Form.Text>
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Maximum Travel Distance (miles)</Form.Label>
                <Form.Control
                  type="number"
                  name="maxTravelDistance"
                  value={profile.maxTravelDistance}
                  onChange={handleNumberChange}
                  min="1"
                  max="1000"
                />
                <Form.Text className="text-muted">
                  How far are you willing to travel for a clinical trial?
                </Form.Text>
              </Form.Group>
            </Col>
          </Row>
          <Row>
            <Col>
              <Form.Group className="mb-3">
                <Form.Label>Minimum Preferred Compensation ($)</Form.Label>
                <Form.Control
                  type="number"
                  name="preferredCompensation"
                  value={profile.preferredCompensation || ''}
                  onChange={handleNumberChange}
                  min="0"
                  placeholder="Enter minimum payment amount"
                />
                <Form.Text className="text-muted">
                  Optional: Enter minimum payment you'd like to receive for participating
                </Form.Text>
              </Form.Group>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      <Card className="mb-4">
        <Card.Header>
          <h4>Medical Information</h4>
        </Card.Header>
        <Card.Body>
          <Form.Group className="mb-4">
            <Form.Label>
              Medical Conditions <span className="text-danger">*</span>
            </Form.Label>
            {validationErrors.medicalConditions && (
              <div className="text-danger mb-2">{validationErrors.medicalConditions}</div>
            )}
            <div className="d-flex mb-2">
              <Form.Control
                type="text"
                value={newCondition}
                onChange={(e) => setNewCondition(e.target.value)}
                placeholder="Enter a medical condition"
              />
              <Button variant="outline-primary" onClick={addCondition} className="ms-2">
                Add
              </Button>
            </div>
            
            <div className="mb-2">
              <small className="text-muted">Common conditions:</small>
              <div className="mt-1">
                {commonConditions.map(condition => (
                  <Button 
                    key={condition}
                    size="sm" 
                    variant="outline-primary" 
                    className="me-1 mb-1" 
                    onClick={() => addCommonCondition(condition)}
                    disabled={profile.medicalConditions.includes(condition)}
                  >
                    {condition}
                  </Button>
                ))}
              </div>
            </div>
            
            <div>
              {profile.medicalConditions.map((condition, index) => (
                <Badge bg="primary" className="me-2 mb-2 p-2" key={index}>
                  {condition}
                  <Button
                    variant="link"
                    size="sm"
                    className="p-0 ms-2 text-white"
                    onClick={() => removeCondition(index)}
                  >
                    ×
                  </Button>
                </Badge>
              ))}
            </div>
            <Form.Text className="text-muted">
              Add all medical conditions you'd like to find trials for
            </Form.Text>
          </Form.Group>

          <Form.Group className="mb-4">
            <Form.Label>Allergies</Form.Label>
            <div className="d-flex mb-2">
              <Form.Control
                type="text"
                value={newAllergy}
                onChange={(e) => setNewAllergy(e.target.value)}
                placeholder="Enter an allergy"
              />
              <Button variant="outline-primary" onClick={addAllergy} className="ms-2">
                Add
              </Button>
            </div>
            
            <div className="mb-2">
              <small className="text-muted">Common allergens:</small>
              <div className="mt-1">
                {commonAllergens.map(allergen => (
                  <Button 
                    key={allergen}
                    size="sm" 
                    variant="outline-danger" 
                    className="me-1 mb-1" 
                    onClick={() => addCommonAllergen(allergen)}
                    disabled={profile.allergies.includes(allergen)}
                  >
                    {allergen}
                  </Button>
                ))}
              </div>
            </div>
            
            <div>
              {profile.allergies.map((allergy, index) => (
                <Badge bg="danger" className="me-2 mb-2 p-2" key={index}>
                  {allergy}
                  <Button
                    variant="link"
                    size="sm"
                    className="p-0 ms-2 text-white"
                    onClick={() => removeAllergy(index)}
                  >
                    ×
                  </Button>
                </Badge>
              ))}
            </div>
            <Form.Text className="text-muted">
              Trials involving substances you're allergic to won't be shown
            </Form.Text>
          </Form.Group>

          <Form.Group className="mb-4">
            <Form.Label>Current Medications</Form.Label>
            <div className="d-flex mb-2">
              <Form.Control
                type="text"
                value={newMedication}
                onChange={(e) => setNewMedication(e.target.value)}
                placeholder="Enter medication name"
              />
              <Button variant="outline-primary" onClick={addMedication} className="ms-2">
                Add
              </Button>
            </div>
            <div>
              {profile.medications.map((medication, index) => (
                <Badge bg="secondary" className="me-2 mb-2 p-2" key={index}>
                  {medication}
                  <Button
                    variant="link"
                    size="sm"
                    className="p-0 ms-2 text-white"
                    onClick={() => removeMedication(index)}
                  >
                    ×
                  </Button>
                </Badge>
              ))}
            </div>
          </Form.Group>
        </Card.Body>
      </Card>

      <Card className="mb-4">
        <Card.Header>
          <h4>Contact Information</h4>
        </Card.Header>
        <Card.Body>
          <Row>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>
                  Email <span className="text-danger">*</span>
                </Form.Label>
                <Form.Control
                  type="email"
                  name="contactEmail"
                  value={profile.contactEmail}
                  onChange={handleInputChange}
                  isInvalid={!!validationErrors.contactEmail}
                  required
                />
                <Form.Control.Feedback type="invalid">
                  {validationErrors.contactEmail}
                </Form.Control.Feedback>
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Phone</Form.Label>
                <Form.Control
                  type="tel"
                  name="contactPhone"
                  value={profile.contactPhone || ''}
                  onChange={handleInputChange}
                  placeholder="(Optional)"
                />
              </Form.Group>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      <div className="d-flex justify-content-end my-4">
        <Button type="submit" variant="primary" size="lg" disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save Profile'}
        </Button>
      </div>

      <div className="mb-4">
        <h5>Profile Completion Status:</h5>
        <div className="progress">
          <div 
            className={`progress-bar ${isProfileComplete ? 'bg-success' : 'bg-warning'}`} 
            role="progressbar" 
            style={{ width: isProfileComplete ? '100%' : '75%' }}
            aria-valuenow={isProfileComplete ? 100 : 75} 
            aria-valuemin={0} 
            aria-valuemax={100}
          >
            {isProfileComplete ? 'Complete' : 'Incomplete'}
          </div>
        </div>
      </div>
    </Form>
  );
};

export default ProfileForm;
import { UserProfile } from '../types/UserProfile';

interface Trial {
  id: string;
  title: string;
  conditions: string[];
  gender: string;
  age_range: {
    min: string;
    max: string;
  };
  locations: {
    city: string;
    state: string;
    country: string;
    zip: string;
    facility: string;
    latitude?: number;
    longitude?: number;
    distance?: number;
  }[];
  summary: string;
  compensation?: {
    has_compensation: boolean;
    amount?: number;
    currency?: string;
    details?: string;
  };
  eligibilityCriteria?: string;
  substancesUsed?: {
    type: string;
    name: string;
  }[];
  distance?: number;
  matchScore?: number;
}

/**
 * Filter out trials that contain substances a user is allergic to
 * @param trials List of trials
 * @param allergies User allergies
 * @returns Filtered trials
 */
export const filterTrialsByAllergies = (trials: Trial[], allergies: string[]): Trial[] => {
  if (!allergies || allergies.length === 0) return trials;
  
  // Normalize allergies for comparison
  const normalizedAllergies = allergies.map(a => a.toLowerCase().trim());
  
  console.log(`Filtering ${trials.length} trials for allergies: ${normalizedAllergies.join(', ')}`);
  
  const filteredTrials = trials.filter(trial => {
    // Check substances used in the trial
    if (trial.substancesUsed && trial.substancesUsed.length > 0) {
      for (const substance of trial.substancesUsed) {
        if (!substance.name) continue;
        
        const substanceName = substance.name.toLowerCase();
        
        for (const allergy of normalizedAllergies) {
          if (substanceName.includes(allergy)) {
            console.log(`Filtered out trial ${trial.id} - contains allergen ${allergy} in substance ${substanceName}`);
            return false; // Has allergen, filter it out
          }
        }
      }
    }
    
    // Also check eligibility criteria text for allergy mentions
    if (trial.eligibilityCriteria) {
      const lowerCriteria = trial.eligibilityCriteria.toLowerCase();
      
      for (const allergy of normalizedAllergies) {
        if (lowerCriteria.includes(`allergy to ${allergy}`) || 
            lowerCriteria.includes(`allergic to ${allergy}`)) {
          console.log(`Filtered out trial ${trial.id} - mentions allergen ${allergy} in criteria`);
          return false;
        }
      }
    }
    
    return true; // Keep this trial
  });
  
  console.log(`After allergy filtering: ${filteredTrials.length} trials remaining`);
  return filteredTrials;
};

/**
 * Calculate a match score between a user profile and a clinical trial
 * @param profile User profile
 * @param trial Clinical trial
 * @returns Match score (0.0 to 1.0)
 */
export const calculateMatchScore = (profile: UserProfile, trial: Trial): number => {
  let score = 0;
  let maxScore = 0;

  // Check if conditions match (highest weight)
  const conditionMatch = trial.conditions && trial.conditions.some(condition => 
    profile.medicalConditions.some(userCondition => 
      userCondition.toLowerCase().includes(condition.toLowerCase()) || 
      condition.toLowerCase().includes(userCondition.toLowerCase())
    )
  );

  if (conditionMatch) {
    score += 50;
  }
  maxScore += 50;

  // Check gender eligibility
  let genderMatch = false;
  if (trial.gender) {
    const normalizedGender = trial.gender.toLowerCase();
    if (normalizedGender === 'all' || 
        normalizedGender.includes('both') || 
        normalizedGender.includes(profile.gender.toLowerCase())) {
      genderMatch = true;
    }
  }
  
  if (genderMatch) {
    score += 15;
  }
  maxScore += 15;

  // Check age eligibility
  const minAge = parseInt(trial.age_range.min) || 0;
  const maxAge = parseInt(trial.age_range.max) || 999;
  
  if (profile.age >= minAge && profile.age <= maxAge) {
    score += 15;
  }
  maxScore += 15;

  // Check location proximity
  if (trial.distance !== undefined) {
    if (trial.distance <= profile.maxTravelDistance) {
      // Full points if very close, fewer points if farther away
      const distanceScore = 20 * (1 - (trial.distance / profile.maxTravelDistance));
      score += Math.max(5, distanceScore);
    }
  }
  maxScore += 20;

  // Check compensation if user has specified minimum preferred compensation
  if (profile.preferredCompensation && profile.preferredCompensation > 0) {
    if (trial.compensation?.has_compensation && trial.compensation.amount) {
      if (trial.compensation.amount >= profile.preferredCompensation) {
        score += 10;
      } else {
        // Partial score based on percentage of desired compensation
        const compensationScore = 10 * (trial.compensation.amount / profile.preferredCompensation);
        score += Math.min(9, compensationScore);
      }
    }
    maxScore += 10;
  }

  // Calculate final score as percentage
  return maxScore > 0 ? score / maxScore : 0;
};

/**
 * Sort trials by match score and distance
 * @param trials List of trials
 * @param profile User profile
 * @returns Sorted trials with calculated match scores
 */
export const rankTrialsByMatchScore = (trials: Trial[], profile: UserProfile): Trial[] => {
  // First filter by allergies
  const filteredTrials = filterTrialsByAllergies(trials, profile.allergies);
  
  // Calculate match scores
  const scoredTrials = filteredTrials.map(trial => {
    const matchScore = calculateMatchScore(profile, trial);
    return { ...trial, matchScore };
  });

  // Sort by match score (descending)
  return scoredTrials.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
};
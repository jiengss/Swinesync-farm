// src/services/aiService.js

/**
 * AI service for pig health predictions.
 * Predicts possible illness based on treatment keywords and computes risk scores.
 */

const ILLNESS_KEYWORDS = {
  antibiotic: 'Bacterial Infection',
  respiratory: 'Respiratory Infection',
  cough: 'Respiratory Infection',
  diarrhea: 'Digestive Issues',
  fever: 'Fever / Systemic Infection',
  parasite: 'Parasitic Infection',
  worm: 'Parasitic Infection',
  skin: 'Skin Condition',
  injury: 'Injury / Trauma',
  vaccine: 'Vaccination',
};

/**
 * Compute AI insights for a list of pigs given their health records.
 * @param {Array} records - health_records array
 * @param {Array} pigs - pigs array
 * @returns {Object} { insights, pigRiskMap }
 */
export function computeAIInsights(records, pigs) {
  const today = new Date();
  const sevenDaysLater = new Date(today);
  sevenDaysLater.setDate(today.getDate() + 7);

  const insights = [];
  const pigRiskMap = {};

  pigs.forEach(pig => {
    const pigRecords = records.filter(r => r.pig_id === pig.id);
    const upcoming = pigRecords.filter(r => r.next_due && new Date(r.next_due) >= today && new Date(r.next_due) <= sevenDaysLater);
    const overdue = pigRecords.filter(r => r.next_due && new Date(r.next_due) < today);
    const treatments = pigRecords.filter(r => r.type && r.type.toLowerCase() !== 'vaccination');
    const recentTreatments = treatments.filter(r => new Date(r.date) > new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000));

    // ---- Predict illness ----
    let predictedCondition = 'Healthy';
    let confidence = 0;
    const treatmentCounts = {};
    treatments.forEach(t => {
      const lowerType = t.type.toLowerCase();
      let matched = false;
      for (const [keyword, illness] of Object.entries(ILLNESS_KEYWORDS)) {
        if (lowerType.includes(keyword)) {
          treatmentCounts[illness] = (treatmentCounts[illness] || 0) + 1;
          matched = true;
          break;
        }
      }
      if (!matched) {
        treatmentCounts['Other'] = (treatmentCounts['Other'] || 0) + 1;
      }
    });

    if (treatments.length > 0) {
      let maxCount = 0;
      let maxIllness = 'Unknown';
      for (const [illness, count] of Object.entries(treatmentCounts)) {
        if (count > maxCount) {
          maxCount = count;
          maxIllness = illness;
        }
      }
      predictedCondition = maxIllness;
      confidence = Math.min(100, Math.round((maxCount / treatments.length) * 100));
      if (predictedCondition === 'Other' && treatments.length > 0) {
        predictedCondition = 'General Health Issue';
        confidence = 50;
      }
    } else if (upcoming.length === 0 && overdue.length === 0 && pigRecords.length === 0) {
      predictedCondition = 'No Records';
    } else if (pigRecords.length > 0 && upcoming.length === 0 && overdue.length === 0) {
      predictedCondition = 'Stable';
    }

    // ---- Risk score ----
    let riskScore = 0;
    if (overdue.length > 0) riskScore += 40;
    if (upcoming.length === 0) riskScore += 20;
    if (recentTreatments.length > 0) riskScore += 10 * Math.min(3, recentTreatments.length);
    if (pigRecords.length === 0) riskScore += 30;
    if (predictedCondition !== 'Healthy' && predictedCondition !== 'Stable' && predictedCondition !== 'No Records') {
      riskScore += 15;
    }
    riskScore = Math.min(100, riskScore);

    let status = 'Low';
    let color = '#10b981';
    if (riskScore >= 60) { status = 'High'; color = '#ef4444'; }
    else if (riskScore >= 30) { status = 'Medium'; color = '#f59e0b'; }

    const pigName = pig.tag || pig.name || pig.id;

    // ---- Generate actionable insight ----
    let insightMessage = '';
    let urgency = 'low';

    if (upcoming.length > 0) {
      const nearest = upcoming.sort((a, b) => new Date(a.next_due) - new Date(b.next_due))[0];
      const days = Math.ceil((new Date(nearest.next_due) - today) / (1000 * 60 * 60 * 24));
      urgency = days <= 3 ? 'high' : 'medium';
      insightMessage = `💉 ${pigName} – "${nearest.type}" due in ${days} day${days > 1 ? 's' : ''} (${predictedCondition})`;
    } else if (overdue.length > 0) {
      const overdueItem = overdue.sort((a, b) => new Date(a.next_due) - new Date(b.next_due))[0];
      urgency = 'high';
      insightMessage = `⚠️ ${pigName} – "${overdueItem.type}" overdue since ${overdueItem.next_due} (${predictedCondition})`;
    } else if (pigRecords.length === 0) {
      urgency = 'medium';
      insightMessage = `📋 ${pigName} – No health records; consider a checkup (${predictedCondition})`;
    } else if (predictedCondition !== 'Healthy' && predictedCondition !== 'Stable' && predictedCondition !== 'No Records') {
      urgency = 'medium';
      insightMessage = `🏥 ${pigName} – Possible ${predictedCondition} (${confidence}% confidence)`;
    } else {
      insightMessage = `✅ ${pigName} – Health appears stable (${predictedCondition})`;
      urgency = 'low';
    }

    insights.push({
      pigId: pig.id,
      message: insightMessage,
      urgency,
      predictedCondition,
      confidence,
      riskScore,
    });

    pigRiskMap[pig.id] = { score: riskScore, status, color, predictedCondition };
  });

  // Sort insights by urgency
  const urgencyOrder = { high: 0, medium: 1, low: 2 };
  insights.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);

  return { insights: insights.slice(0, 5), pigRiskMap };
}

// Knowledge Base of Diseases
export const DISEASES_KB = [
  {
    name: 'Swine Influenza (SIV)',
    symptoms: ['Coughing', 'Fever', 'Nasal Discharge', 'Breathing Difficulty', 'Lethargy'],
    description: 'A highly contagious viral respiratory disease in pigs, causing sudden fever, lethargy, coughing, and runny nose.',
    cure: 'Supportive care: isolate affected pigs, provide clean electrolyte water, administer anti-inflammatory medications (e.g., flunixin meglumine), and ensure a dust-free, warm environment.',
    severity: 'Medium'
  },
  {
    name: 'Erysipelas',
    symptoms: ['Skin Lesions', 'Fever', 'Lethargy', 'Loss of Appetite'],
    description: 'A bacterial infection causing red diamond-shaped skin lesions, very high fever, stiff joints, and loss of appetite.',
    cure: 'Antibiotic therapy: inject Penicillin G or Ampicillin immediately. Apply vaccine boosters to the herd, disinfect the pen, and provide fresh bedding.',
    severity: 'High'
  },
  {
    name: 'Swine Dysentery / PED',
    symptoms: ['Diarrhea', 'Vomiting', 'Lethargy', 'Loss of Appetite'],
    description: 'A severe intestinal illness causing severe watery diarrhea, dehydration, and vomiting.',
    cure: 'Hydration therapy: supply oral electrolyte solutions immediately. Administer antibiotics (Tylosin or Lincomycin) in water. Sanitize the housing thoroughly.',
    severity: 'High'
  },
  {
    name: 'Mycoplasmal Pneumonia',
    symptoms: ['Coughing', 'Breathing Difficulty', 'Lethargy'],
    description: 'A chronic respiratory bacterial disease characterized by a persistent dry cough and slowed growth rates.',
    cure: 'Injectable/feed antibiotics: Lincomycin, Tylosin, or Tiamulin. Improve ventilation, reduce pen stocking density, and minimize dust.',
    severity: 'Medium'
  },
  {
    name: 'Sarcoptic Mange',
    symptoms: ['Scratching', 'Skin Lesions', 'Lethargy'],
    description: 'An itchy skin condition caused by parasitic mites, resulting in scratching, scabs, and skin crusts.',
    cure: 'Mite treatment: administer Ivermectin or Doramectin (injection or feed additive). Spray the pen/animals with amitraz or other miticides.',
    severity: 'Low'
  }
];

export function predictDiseaseFromSymptoms(selectedSymptoms) {
  if (!selectedSymptoms || selectedSymptoms.length === 0) {
    return [];
  }

  const results = [];

  DISEASES_KB.forEach(disease => {
    // Calculate matched symptoms
    const matched = disease.symptoms.filter(sym => selectedSymptoms.includes(sym));
    const score = matched.length;

    // Confidence is computed as the percentage of the disease's diagnostic symptoms present
    const confidence = Math.round((matched.length / disease.symptoms.length) * 100);

    const totalSymptoms = Array.from(new Set([...disease.symptoms, ...selectedSymptoms]));
    const jaccard = matched.length / totalSymptoms.length;

    if (score > 0) {
      results.push({
        ...disease,
        matchedSymptoms: matched,
        confidence: confidence,
        jaccard: jaccard,
      });
    }
  });

  // Sort by confidence (highest first), then Jaccard index
  return results.sort((a, b) => b.confidence - a.confidence || b.jaccard - a.jaccard);
}
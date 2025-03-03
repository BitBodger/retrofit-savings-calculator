import { useState, useCallback, useEffect } from 'react';
import axios from 'axios';
import TabHeader from './TabHeader';
import BasicForm from './BasicForm';
import PropertyForm from './PropertyForm';
import Results from './Results';
import measureDefaults from './measureDefaults';
import MeasuresForm from './MeasuresForm';

function Calculator() {
  // -------------------------------
  // State Declarations
  // -------------------------------
  // Basic inputs shared between forms (stored as strings for display)
  const [inputs, setInputs] = useState({
    installation_cost: '',
    installation_lifetime: '25',
    energy_savings_per_year: '',
    loan_interest_rate: '6',
    loan_term: '5',
    discount_rate: '3',
    energy_price_escalation: '2',
    down_payment: '',
    government_subsidy: '',
    home_size: 'medium',
    existing_heating_system: 'old_gas_boiler',
    existing_glazing: '',
    existing_doors: '',
    existing_wall_insulation: '',
    existing_loft_insulation: '100mm',
    existing_floor_insulation: '',
  });

  // Flag for whether discounting should be applied
  const [applyDiscount, setApplyDiscount] = useState(true);

  // Set loading state for showing loading dots.
  const [loading, setLoading] = useState(false);

  // Calculation result returned from backend
  const [results, setResults] = useState(null);

  // Active tab control ("basic" or "advanced")
  const [activeTab, setActiveTab] = useState("basic");

  // Active tab control ("basic" or "advanced")
  const [activeAdvancedTab, setActiveAdvancedTab] = useState("property");

  // Measures added in advanced mode (each with its own fields)
  const [measures, setMeasures] = useState([{ name: '', installation_cost: '', ancillary_cost: '', annual_savings: '', lifetime: '' }]);

  // Additional state for error messages
  const [errorMessage, setErrorMessage] = useState('');

  // -------------------------------
  // Handler Functions
  // -------------------------------

  // Toggle discounting checkbox
  const handleApplyDiscountChange = (e) => {
    setApplyDiscount(e.target.checked);
  };

  // Generic handler for basic input changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setInputs(prev => ({ ...prev, [name]: value }));
  };

  // Returns a multiplier based on the home size (small, medium, large)
  const getHomeSizeMultiplier = (homeSize) => {
    if (homeSize.toLowerCase() === "small") return 0.67;
    if (homeSize.toLowerCase() === "large") return 1.5;
    return 1.0;
  };

  // Add a new (empty) measure to the measures array
  const addNewMeasure = () => {
    setMeasures(prev => [
      ...prev,
      { name: '', installation_cost: '', ancillary_cost: '', annual_savings: '', lifetime: '' }
    ]);
  };

  // Handler to update a measure at a specific index.
  // When the measure name is changed, look up defaults from measureDefaults,
  // apply the home size multiplier, and if available -
  // override the default annual savings depending on existing details about the property.
  const handleMeasureChange = (index, e) => {
    const { name, value } = e.target;
    setMeasures(prevMeasures => {
      const newMeasures = [...prevMeasures];
      if (name === "name") {
        const multiplier = getHomeSizeMultiplier(inputs.home_size);
        const defaults = measureDefaults[value.toLowerCase()] || {};
        let defaultAnnualSavings = defaults.annual_savings;

        // Check existing heating system to make more accurate prediction of savings
        if (defaults.existingHeatingSystem && inputs.existing_heating_system) {
          const existingKey = inputs.existing_heating_system.toLowerCase();
          if (defaults.existingHeatingSystem[existingKey] !== undefined) {
            defaultAnnualSavings = defaults.existingHeatingSystem[existingKey];
          }
        }

        // Check existing glazing to make more accurate prediction of savings
        if (defaults.existingGlazing && inputs.existing_glazing) {
          const existingKey = inputs.existing_glazing.toLowerCase();
          if (defaults.existingGlazing[existingKey] !== undefined) {
            defaultAnnualSavings = defaults.existingGlazing[existingKey];
          }
        }
        
        // Check existing loft insulation to make more accurate prediction of savings
        if (defaults.existingLoftInsulation && inputs.existing_loft_insulation) {
          const existingKey = inputs.existing_loft_insulation.toLowerCase();
          if (defaults.existingLoftInsulation[existingKey] !== undefined) {
            defaultAnnualSavings = defaults.existingLoftInsulation[existingKey];
          }
        }
        
        newMeasures[index] = { 
          ...newMeasures[index],
          name: value,
          // Store raw numeric values (as numbers) for later conversion
          installation_cost: defaults.installation_cost 
            ? parseFloat(defaults.installation_cost) * multiplier 
            : '',
          annual_savings: defaultAnnualSavings 
            ? parseFloat(defaultAnnualSavings) * multiplier 
            : '',
          lifetime: defaults.lifetime 
            ? defaults.lifetime.toString() 
            : newMeasures[index].lifetime,
        };
      } else {
        newMeasures[index] = { 
          ...newMeasures[index],
          [name]: value,
        };
      }
      return newMeasures;
    });
  };

  // Remove a measure by its index
  const handleRemoveMeasure = (indexToRemove) => {
    setMeasures(prevMeasures => prevMeasures.filter((_, idx) => idx !== indexToRemove));
  };

  // -------------------------------
  // useEffect Hooks for Derived Calculations
  // -------------------------------

  // When the advanced tab is active, derive basic input values from the measures.
  useEffect(() => {
    if (measures.length > 0 && activeTab === "advanced") {
      const derivedInstallationCost = measures.reduce(
        (sum, measure) => sum + parseFloat(measure.installation_cost || 0)
        + parseFloat(measure.ancillary_cost || 0),
        0
      );
      const derivedEnergySavings = measures.reduce(
        (sum, measure) => sum + parseFloat(measure.annual_savings || 0),
        0
      );
      const derivedInstallationLifetime = measures.reduce(
        (max, measure) => Math.max(max, parseInt(measure.lifetime || 0, 10)),
        0
      );
  
      setInputs(prev => ({
        ...prev,
        installation_cost: derivedInstallationCost.toFixed(2),
        energy_savings_per_year: derivedEnergySavings.toFixed(2),
        installation_lifetime: derivedInstallationLifetime.toString(),
      }));
    }
  }, [activeTab, measures]);

  // When the existing property details change, update the default annual savings of certain measures.
  useEffect(() => {
    const existingHeatingSystemKey = inputs.existing_heating_system.toLowerCase();
    const existingGlazingKey = inputs.existing_glazing.toLowerCase();
    const existingLoftInsulationKey = inputs.existing_loft_insulation.toLowerCase();
    setMeasures(prevMeasures =>
      prevMeasures.map(m => {
        const measureDef = measureDefaults[m.name?.toLowerCase()];
        if (!measureDef) return m;
  
        let defaultAnnualSavings = measureDef.annual_savings;
        if (measureDef.existingHeatingSystem && measureDef.existingHeatingSystem[existingHeatingSystemKey] !== undefined) {
          defaultAnnualSavings = measureDef.existingHeatingSystem[existingHeatingSystemKey];
        }
        if (measureDef.existingGlazing && measureDef.existingGlazing[existingGlazingKey] !== undefined) {
          defaultAnnualSavings = measureDef.existingGlazing[existingGlazingKey];
        }
        if (measureDef.existingLoftInsulation && measureDef.existingLoftInsulation[existingLoftInsulationKey] !== undefined) {
          defaultAnnualSavings = measureDef.existingLoftInsulation[existingLoftInsulationKey];
        }
        // Update the measure's annual_savings
        return {
          ...m,
          annual_savings: defaultAnnualSavings,
        };
      })
    );
  }, [inputs.existing_heating_system, inputs.existing_glazing, inputs.existing_loft_insulation]);

  

  // When the home size changes, update each measure's default values.
  useEffect(() => {
    const multiplier = getHomeSizeMultiplier(inputs.home_size);
    setMeasures(prevMeasures =>
      prevMeasures.map(measure => {
        if (measure.name && measureDefaults[measure.name.toLowerCase()]) {
          const defaults = measureDefaults[measure.name.toLowerCase()];
          return {
            ...measure,
            installation_cost: defaults.installation_cost 
              ? parseFloat(defaults.installation_cost) * multiplier
              : measure.installation_cost,
            annual_savings: defaults.annual_savings 
              ? parseFloat(defaults.annual_savings) * multiplier
              : measure.annual_savings,
          };
        }
        return measure;
      })
    );
  }, [inputs.home_size]);


  // -------------------------------
  // Derived Calculation for Loan Amount
  // -------------------------------
  const calculatedLoanAmount = (
    parseFloat(inputs.installation_cost || 0) -
    parseFloat(inputs.down_payment || 0) -
    parseFloat(inputs.government_subsidy || 0)
  );

  // -------------------------------
  // recalc: Main Calculation Function
  // -------------------------------
  const recalc = useCallback(() => {
    // Set loading state to TRUE to start loading dots
    setLoading(true);

    // Log measures for debugging
    console.log("Original measures:", measures);
    
    // Filter out incomplete measures (e.g. missing name, lifetime, or non-numeric values)
    const validMeasures = measures.filter((measure) => {
      const nameValid = measure.name.trim() !== "";
      const lifetimeNum = parseInt(measure.lifetime, 10);
      const lifetimeValid = !isNaN(lifetimeNum);
      const costValid = !isNaN(parseFloat(measure.installation_cost));
      const savingsValid = !isNaN(parseFloat(measure.annual_savings));
      return nameValid && lifetimeValid && costValid && savingsValid;
    });
    
    console.log("Valid measures:", validMeasures);
    
    // Build payload: convert strings to numbers explicitly.
    const payload = {
      installation_cost: parseFloat(inputs.installation_cost),
      installation_lifetime: parseInt(inputs.installation_lifetime, 10),
      energy_savings_per_year: parseFloat(inputs.energy_savings_per_year),
      loan_interest_rate: parseFloat(inputs.loan_interest_rate) / 100,
      loan_term: parseInt(inputs.loan_term, 10),
      discount_rate: parseFloat(inputs.discount_rate) / 100,
      energy_price_escalation: parseFloat(inputs.energy_price_escalation) / 100,
      down_payment: parseFloat(inputs.down_payment) || 0,
      government_subsidy: parseFloat(inputs.government_subsidy) || 0,
      home_size: inputs.home_size,
      existing_heating_system: inputs.existing_heating_system,
      use_advanced_form: activeTab === "advanced",
      measures: validMeasures.map(measure => ({
        name: measure.name,
        installation_cost: parseFloat(measure.installation_cost) + parseFloat(measure.ancillary_cost || 0),
        annual_savings: parseFloat(measure.annual_savings),
        lifetime: parseInt(measure.lifetime, 10)
      }))
    };
    
    console.log("Payload:", payload);
    
    axios
      .post('./api/calculate', payload)
      .then(response => {
        console.log("Response:", response.data);
        setResults(response.data);
        setErrorMessage(''); // clear any existing errors
      })
      .catch(error => console.error('Error making API call:', error))
      .finally(() => setLoading(false));

  }, [inputs, activeTab, measures]);

  // -------------------------------
  // Form Submission Handler
  // -------------------------------
  const handleSubmit = (e) => {
    e.preventDefault();

    const installationCost = parseFloat(inputs.installation_cost);
    const installationLifetime = parseInt(inputs.installation_lifetime);
    const energySavings = parseFloat(inputs.energy_savings_per_year);
    const upfrontPayments = parseFloat(inputs.down_payment) || "0" + parseFloat(inputs.government_subsidy) || "0";

    // Check if the essential fields are empty or 0
    if (!installationCost || installationCost === 0) {
      // Optionally, set an error state or simply return without calling recalc
      setErrorMessage("Please provide valid value for Installation Cost");
      return;
    }

    if (!installationLifetime || installationLifetime === 0) {
      // Optionally, set an error state or simply return without calling recalc
      setErrorMessage("Please provide valid value for Installation Lifetime");
      return;
    }

    if (!energySavings) {
      // Optionally, set an error state or simply return without calling recalc
      setErrorMessage("Please provide valid value for Energy Savings Per Year");
      return;
    }


    // Check if the sum or government subsidy and down payment are greater than the installation cost.
    if (upfrontPayments > installationCost) {
      setErrorMessage("The Upfront Payments are greater than the Installation Cost")
      return;
    }

    recalc();
  };

  // -------------------------------
  // Render Component
  // -------------------------------
  return (
    <div className="calculator">
      <TabHeader 
        activeTab={activeTab} setActiveTab={setActiveTab} 
        activeAdvancedTab={activeAdvancedTab} setActiveAdvancedTab={setActiveAdvancedTab}
      />

      {activeTab === "advanced" && activeAdvancedTab == "property" && (
        <PropertyForm
          inputs={inputs}
          handleChange={handleChange}
        />
      )}

      {activeTab === "advanced" && activeAdvancedTab == "measures" && (
        <MeasuresForm
          inputs={inputs}
          handleChange={handleChange}
          measures={measures}
          handleMeasureChange={handleMeasureChange}
          addNewMeasure={addNewMeasure}
          handleRemoveMeasure={handleRemoveMeasure}
        />
      )}

      {activeTab === "advanced" && (
        <hr />
      )}

      <BasicForm
        inputs={inputs}
        handleChange={handleChange}
        calculatedLoanAmount={calculatedLoanAmount}
        handleSubmit={handleSubmit}
        applyDiscount={applyDiscount}
        handleApplyDiscountChange={handleApplyDiscountChange}
        advancedActive={activeTab === "advanced"}
        errorMessage={errorMessage}
        loading={loading}
      />

      {results && (
        <Results
          results={results}
          applyDiscount={applyDiscount}
          handleApplyDiscountChange={handleApplyDiscountChange}
        />
      )}
    </div>
  );
}

export default Calculator;

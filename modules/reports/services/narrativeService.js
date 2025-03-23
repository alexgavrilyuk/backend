// modules/reports/services/narrativeService.js

const { OpenAI } = require('openai');
require('dotenv').config();

// Initialize OpenAI client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Service for generating natural language narratives from data and insights
 * Creates explanatory text for different report sections
 */
class NarrativeService {
  /**
   * Generate a natural language narrative explaining report findings
   * @param {string} query - Original natural language query
   * @param {Array} data - Query result data
   * @param {Array} insights - Extracted insights
   * @param {Object} dataset - Dataset metadata
   * @param {string} reportType - Type of report being generated
   * @param {boolean} isComplex - Whether this is a complex multi-dataset query
   * @returns {Promise<string>} Generated narrative
   */
  async generateNarrative(query, data, insights, dataset, reportType, stepResults = null) {
    try {
      // Determine if this is a complex query based on stepResults parameter
      const isComplex = stepResults !== null;

      console.log(`Generating narrative for query: "${query}", isComplex: ${isComplex}`);

      // For complex queries, use stepResults as data if no data provided
      if (isComplex && (!data || data.length === 0) && stepResults) {
        data = stepResults;
      }

      // Check if data is available
      const hasData = this.checkDataAvailability(data, isComplex);

      // For empty data sets, return a simple message
      if (!hasData) {
        return "The query didn't return any data. Please try a different query or check if the dataset contains the requested information.";
      }

      // If there are no insights, generate a basic narrative
      if (!insights || insights.length === 0) {
        return this.generateBasicNarrative(query, data, dataset, isComplex);
      }

      // Try generating a narrative using OpenAI
      try {
        const aiNarrative = await this.generateNarrativeWithAI(query, data, insights, dataset, isComplex);
        if (aiNarrative) {
          return aiNarrative;
        }
      } catch (aiError) {
        console.error('Error generating narrative with AI:', aiError);
        // Fall back to template-based narrative
      }

      // Fall back to template-based narrative if AI fails
      return this.generateTemplateNarrative(query, data, insights, dataset, isComplex);
    } catch (error) {
      console.error('Error generating narrative:', error);
      // Return a simple fallback message
      const dataLength = this.getDataLength(data, isComplex);
      return `Analysis complete. The query returned ${dataLength} rows of data.`;
    }
  }

  /**
   * Check if data is available, handling both simple and complex data structures
   * @param {Array|Object} data - Data from query results
   * @param {boolean} isComplex - Whether this is a complex query
   * @returns {boolean} Whether data is available
   */
  checkDataAvailability(data, isComplex) {
    if (!data) return false;

    if (isComplex) {
      // For complex queries, check if any component has data
      if (Array.isArray(data)) {
        return data.length > 0;
      } else if (typeof data === 'object') {
        // If stepResults format with stepX keys
        const stepKeys = Object.keys(data).filter(key => key.startsWith('step'));
        if (stepKeys.length > 0) {
          return stepKeys.some(key => Array.isArray(data[key]) && data[key].length > 0);
        }

        // If it's a nested structure with components
        if (data.results || data.components) {
          const components = data.results || data.components;
          return Array.isArray(components) && components.some(comp =>
            Array.isArray(comp.data) && comp.data.length > 0
          );
        }

        // Check any property that might contain data arrays
        for (const key in data) {
          if (Array.isArray(data[key]) && data[key].length > 0) {
            return true;
          }
        }
        return false;
      }
    } else {
      // Simple query - just check array length
      return Array.isArray(data) && data.length > 0;
    }

    return false;
  }

  /**
   * Get the length of data, handling both simple and complex data structures
   * @param {Array|Object} data - Data from query results
   * @param {boolean} isComplex - Whether this is a complex query
   * @returns {number} Total length of data
   */
  getDataLength(data, isComplex) {
    if (!data) return 0;

    if (isComplex) {
      // For complex queries, sum the length of all components
      if (Array.isArray(data)) {
        return data.length;
      } else if (typeof data === 'object') {
        let totalLength = 0;

        // If it's a nested structure with components
        if (data.results || data.components) {
          const components = data.results || data.components;
          if (Array.isArray(components)) {
            components.forEach(comp => {
              if (Array.isArray(comp.data)) {
                totalLength += comp.data.length;
              }
            });
          }
          return totalLength;
        }

        // Check any property that might contain data arrays
        for (const key in data) {
          if (Array.isArray(data[key])) {
            totalLength += data[key].length;
          }
        }
        return totalLength;
      }
      return 0;
    } else {
      // Simple query - just return array length
      return Array.isArray(data) ? data.length : 0;
    }
  }

  /**
   * Generate a basic narrative for data with no insights
   * @param {string} query - Original natural language query
   * @param {Array|Object} data - Query result data
   * @param {Object} dataset - Dataset metadata
   * @param {boolean} isComplex - Whether this is a complex query
   * @returns {string} Basic narrative
   */
  generateBasicNarrative(query, data, dataset, isComplex) {
    if (isComplex) {
      // For complex queries, create a narrative that addresses multiple datasets
      return this.generateBasicComplexNarrative(query, data, dataset);
    }

    // Sample the first few rows for reference
    const sampleSize = Math.min(5, data.length);
    const sampleData = data.slice(0, sampleSize);

    // Get column names
    const columnNames = Object.keys(data[0] || {}).join(', ');

    return `
      ## Query Results

      Your query "${query}" returned ${data.length} rows from the ${dataset.name} dataset.

      The results include the following columns: ${columnNames}.

      ${sampleSize === data.length ? 'Here is the complete result:' : `Here's a sample of the first ${sampleSize} rows:`}

      ${this.formatSampleDataAsText(sampleData)}

      For more detailed analysis, you can explore the visualizations and data table in this report.
    `.trim().replace(/\n\s+/g, '\n');
  }

  /**
   * Generate a basic narrative specifically for complex multi-dataset queries
   * @param {string} query - Original natural language query
   * @param {Array|Object} data - Complex query result data
   * @param {Object} dataset - Dataset metadata
   * @returns {string} Basic narrative for complex query
   */
  generateBasicComplexNarrative(query, data, dataset) {
    // Create an appropriate narrative for a multi-dataset query
    let datasetComponents = [];
    let totalRows = 0;

    // Extract data components from complex structure
    if (data.results || data.components) {
      const components = data.results || data.components;
      if (Array.isArray(components)) {
        components.forEach((comp, index) => {
          if (comp.data && Array.isArray(comp.data)) {
            totalRows += comp.data.length;
            datasetComponents.push({
              name: comp.name || comp.id || `Component ${index + 1}`,
              rows: comp.data.length,
              columns: comp.data[0] ? Object.keys(comp.data[0]) : []
            });
          }
        });
      }
    } else if (Array.isArray(data)) {
      totalRows = data.length;
      datasetComponents.push({
        name: "Main component",
        rows: data.length,
        columns: data[0] ? Object.keys(data[0]) : []
      });
    }

    // Create the narrative
    return `
      ## Multi-Dataset Query Results

      Your complex query "${query}" analyzed multiple datasets, returning a total of ${totalRows} rows.

      ${datasetComponents.map(comp =>
        `### ${comp.name}\n` +
        `- Rows: ${comp.rows}\n` +
        `- Columns: ${comp.columns.join(', ')}`
      ).join('\n\n')}

      The visualizations in this report combine data from these components to provide a comprehensive view.
      For more detailed analysis, you can explore the individual visualizations and data tables.
    `.trim().replace(/\n\s+/g, '\n');
  }

  /**
   * Generate narrative using OpenAI
   * @param {string} query - Original natural language query
   * @param {Array|Object} data - Query result data
   * @param {Array} insights - Extracted insights
   * @param {Object} dataset - Dataset metadata
   * @param {boolean} isComplex - Whether this is a complex query
   * @returns {Promise<string>} AI-generated narrative
   */
  async generateNarrativeWithAI(query, data, insights, dataset, isComplex) {
    // Prepare data for prompt based on whether it's a complex query
    let sampleData;
    let dataDescription;

    if (isComplex) {
      // For complex queries, prepare a representative sample from each component
      const components = [];
      let totalRows = 0;

      // Handle stepResults format (the format used in reportGenerationService)
      if (typeof data === 'object' && !Array.isArray(data)) {
        const stepKeys = Object.keys(data).filter(key => key.startsWith('step'));

        if (stepKeys.length > 0) {
          console.log(`Processing complex query with ${stepKeys.length} step components`);

          stepKeys.forEach(stepKey => {
            if (Array.isArray(data[stepKey]) && data[stepKey].length > 0) {
              const stepData = data[stepKey];
              const componentSampleSize = Math.min(5, stepData.length);
              totalRows += stepData.length;

              // Try to determine a meaningful name for this step
              let stepName = stepKey;

              // Look for common patterns in the data to determine component type
              const firstRow = stepData[0];
              if (firstRow) {
                const keys = Object.keys(firstRow);
                if (keys.some(k => k.toLowerCase().includes('client') || k.toLowerCase().includes('customer'))) {
                  stepName = "Client Analysis";
                } else if (keys.some(k => k.toLowerCase().includes('therapy') || k.toLowerCase().includes('area'))) {
                  stepName = "Therapy Area Analysis";
                }
              }

              components.push({
                name: stepName,
                rows: stepData.length,
                sample: stepData.slice(0, componentSampleSize)
              });
            }
          });
        }
      } else if (data.results || data.components) {
        const dataComponents = data.results || data.components;
        if (Array.isArray(dataComponents)) {
          dataComponents.forEach((comp, index) => {
            if (comp.data && Array.isArray(comp.data)) {
              const componentSampleSize = Math.min(5, comp.data.length);
              totalRows += comp.data.length;
              components.push({
                name: comp.name || comp.id || `Component ${index + 1}`,
                rows: comp.data.length,
                sample: comp.data.slice(0, componentSampleSize)
              });
            }
          });
        }
      } else if (Array.isArray(data)) {
        const componentSampleSize = Math.min(5, data.length);
        totalRows = data.length;
        components.push({
          name: "Main dataset",
          rows: data.length,
          sample: data.slice(0, componentSampleSize)
        });
      }

      sampleData = components;
      dataDescription = `Complex query with ${components.length} components, ${totalRows} total rows`;
    } else {
      // For simple queries, use the existing approach
      const sampleSize = Math.min(10, data.length);
      sampleData = data.slice(0, sampleSize);
      dataDescription = `${data.length} rows returned`;
    }

    // Prepare insights for prompt
    const insightsText = insights.map(insight => {
      return `- ${insight.title || 'Insight'}: ${insight.description}`;
    }).join('\n');

    // Prepare system prompt
    const systemPrompt = `
      You are an expert data analyst who explains data insights in clear language.
      Your task is to write a concise, informative narrative about the data and insights provided.
      ${isComplex ? 'This is a complex query spanning multiple datasets or components. Please analyze connections between the components and provide a holistic view.' : ''}
      Use markdown formatting for better readability.
      Include sections with headers (##) where appropriate.
      Be factual and precise - only describe what's in the data and insights.
      Do not make assumptions beyond what's explicitly in the data.
      Focus on answering the user's original query and explaining key patterns.
      Keep your explanation under 300 words.
    `.trim();

    // Prepare user prompt with data and insights
    let userPrompt;

    if (isComplex) {
      // Complex query prompt
      userPrompt = `
        Original complex query: "${query}"

        Dataset: ${dataset.name}

        This is a complex multi-component analysis with:
        ${sampleData.map(comp => `- ${comp.name}: ${comp.rows} rows`).join('\n')}

        Insights extracted:
        ${insightsText}

        Sample data from each component:
        ${sampleData.map(comp => `
          ${comp.name} (${comp.sample.length} of ${comp.rows} rows):
          ${JSON.stringify(comp.sample, null, 2)}
        `).join('\n')}

        Based on this information, write a clear narrative that explains the results of this complex query and the key insights.
        Focus on how the different components relate to each other and the most significant patterns or findings across the entire analysis.
      `.trim();
    } else {
      // Simple query prompt
      userPrompt = `
        Original query: "${query}"

        Dataset: ${dataset.name}

        Data summary: ${dataDescription}

        Insights extracted:
        ${insightsText}

        Sample data:
        ${JSON.stringify(sampleData, null, 2)}

        Based on this information, write a clear narrative that explains the results of the query and the key insights.
        Focus on directly answering the query and highlighting the most significant patterns or findings.
      `.trim();
    }

    try {
      // Call OpenAI to generate the narrative
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.5, // Lower temperature for more consistent outputs
        max_tokens: 1000 // Limit response length
      });

      return response.choices[0].message.content.trim();
    } catch (error) {
      console.error('OpenAI API error:', error);
      return null; // Return null to trigger fallback to template-based narrative
    }
  }

  /**
   * Generate narrative using templates based on insight types
   * @param {string} query - Original natural language query
   * @param {Array|Object} data - Query result data
   * @param {Array} insights - Extracted insights
   * @param {Object} dataset - Dataset metadata
   * @param {boolean} isComplex - Whether this is a complex query
   * @returns {string} Template-based narrative
   */
  generateTemplateNarrative(query, data, insights, dataset, isComplex) {
    // Start with an introduction
    let narrative = `## Analysis of ${dataset.name}\n\n`;

    if (isComplex) {
      narrative += `Your complex query "${query}" analyzed multiple datasets. Here's what we found:\n\n`;
    } else {
      const dataLength = this.getDataLength(data, isComplex);
      narrative += `Your query "${query}" returned ${dataLength} rows of data. Here's what we found:\n\n`;
    }

    // Add insights organized by sections
    const statisticInsights = insights.filter(i => i.type === 'statistic');
    const trendInsights = insights.filter(i => i.type === 'trend');
    const performerInsights = insights.filter(i =>
      i.type === 'top_performer' || i.type === 'bottom_performer'
    );
    const distributionInsights = insights.filter(i =>
      i.type === 'distribution' || i.type === 'concentration' || i.type === 'range'
    );

    // Add key statistics section
    if (statisticInsights.length > 0) {
      narrative += "## Key Statistics\n\n";
      statisticInsights.forEach(insight => {
        narrative += `- ${insight.description}\n`;
      });
      narrative += "\n";
    }

    // Add trends section
    if (trendInsights.length > 0) {
      narrative += "## Trends\n\n";
      trendInsights.forEach(insight => {
        narrative += `- ${insight.description}\n`;
      });
      narrative += "\n";
    }

    // Add top/bottom performers section
    if (performerInsights.length > 0) {
      narrative += "## Key Performers\n\n";
      performerInsights.forEach(insight => {
        narrative += `- ${insight.description}\n`;
      });
      narrative += "\n";
    }

    // Add distribution section
    if (distributionInsights.length > 0) {
      narrative += "## Distribution Analysis\n\n";
      distributionInsights.forEach(insight => {
        narrative += `- ${insight.description}\n`;
      });
      narrative += "\n";
    }

    // Add a summary section
    narrative += "## Summary\n\n";

    if (isComplex) {
      narrative += "This complex analysis spans multiple datasets, providing a comprehensive view. ";
    }

    if (insights.length > 0) {
      // Add a relevant summary based on insight types
      if (trendInsights.length > 0) {
        narrative += "The data shows notable trends that may inform business decisions. ";
      }

      if (performerInsights.length > 0) {
        narrative += "There are significant variations in performance across different categories. ";
      }

      if (distributionInsights.length > 0) {
        narrative += "The distribution of values shows patterns that merit attention. ";
      }
    }

    narrative += `Review the visualizations and data table for more detailed information.`;

    return narrative;
  }

  /**
   * Format sample data as readable text
   * @param {Array} data - Sample data rows
   * @returns {string} Formatted text representation
   */
  formatSampleDataAsText(data) {
    if (!data || data.length === 0) {
      return 'No data available.';
    }

    // For very simple data, convert to a readable format
    if (data.length <= 3 && Object.keys(data[0]).length <= 4) {
      return data.map(row => {
        return Object.entries(row)
          .map(([key, value]) => `${key}: ${value}`)
          .join(', ');
      }).join('\n');
    }

    // For more complex data, return a summary
    return `Data contains ${data.length} rows with ${Object.keys(data[0]).length} columns per row.`;
  }
}

// Export a singleton instance
module.exports = new NarrativeService();
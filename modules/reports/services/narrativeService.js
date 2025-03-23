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
   * @returns {Promise<string>} Generated narrative
   */
  async generateNarrative(query, data, insights, dataset, reportType) {
    try {
      // For empty data sets, return a simple message
      if (!data || data.length === 0) {
        return "The query didn't return any data. Please try a different query or check if the dataset contains the requested information.";
      }

      console.log(`Generating narrative for query: "${query}"`);

      // If there are no insights, generate a basic narrative
      if (!insights || insights.length === 0) {
        return this.generateBasicNarrative(query, data, dataset);
      }

      // Try generating a narrative using OpenAI
      try {
        const aiNarrative = await this.generateNarrativeWithAI(query, data, insights, dataset);
        if (aiNarrative) {
          return aiNarrative;
        }
      } catch (aiError) {
        console.error('Error generating narrative with AI:', aiError);
        // Fall back to template-based narrative
      }

      // Fall back to template-based narrative if AI fails
      return this.generateTemplateNarrative(query, data, insights, dataset);
    } catch (error) {
      console.error('Error generating narrative:', error);
      // Return a simple fallback message
      return `Analysis complete. The query returned ${data ? data.length : 0} rows of data.`;
    }
  }

  /**
   * Generate a basic narrative for data with no insights
   * @param {string} query - Original natural language query
   * @param {Array} data - Query result data
   * @param {Object} dataset - Dataset metadata
   * @returns {string} Basic narrative
   */
  generateBasicNarrative(query, data, dataset) {
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
   * Generate narrative using OpenAI
   * @param {string} query - Original natural language query
   * @param {Array} data - Query result data
   * @param {Array} insights - Extracted insights
   * @param {Object} dataset - Dataset metadata
   * @returns {Promise<string>} AI-generated narrative
   */
  async generateNarrativeWithAI(query, data, insights, dataset) {
    // Prepare sample data (limit to avoid token limits)
    const sampleSize = Math.min(10, data.length);
    const sampleData = data.slice(0, sampleSize);

    // Prepare insights for prompt
    const insightsText = insights.map(insight => {
      return `- ${insight.title}: ${insight.description}`;
    }).join('\n');

    // Prepare system prompt
    const systemPrompt = `
      You are an expert data analyst who explains data insights in clear language.
      Your task is to write a concise, informative narrative about the data and insights provided.
      Use markdown formatting for better readability.
      Include sections with headers (##) where appropriate.
      Be factual and precise - only describe what's in the data and insights.
      Do not make assumptions beyond what's explicitly in the data.
      Focus on answering the user's original query and explaining key patterns.
      Keep your explanation under 300 words.
    `.trim();

    // Prepare user prompt with data and insights
    const userPrompt = `
      Original query: "${query}"

      Dataset: ${dataset.name}

      Data summary: ${data.length} rows returned

      Insights extracted:
      ${insightsText}

      Sample data (${sampleSize} of ${data.length} rows):
      ${JSON.stringify(sampleData, null, 2)}

      Based on this information, write a clear narrative that explains the results of the query and the key insights.
      Focus on directly answering the query and highlighting the most significant patterns or findings.
    `.trim();

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
   * @param {Array} data - Query result data
   * @param {Array} insights - Extracted insights
   * @param {Object} dataset - Dataset metadata
   * @returns {string} Template-based narrative
   */
  generateTemplateNarrative(query, data, insights, dataset) {
    // Start with an introduction
    let narrative = `## Analysis of ${dataset.name}\n\n`;
    narrative += `Your query "${query}" returned ${data.length} rows of data. Here's what we found:\n\n`;

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
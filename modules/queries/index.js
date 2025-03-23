// modules/queries/index.js
const queryController = require('./controller');
const queryRoutes = require('./routes');

module.exports = {
  controller: queryController,
  routes: queryRoutes,
  metadata: {
    name: 'queries',
    description: 'Handles natural language query processing and execution'
  }
};
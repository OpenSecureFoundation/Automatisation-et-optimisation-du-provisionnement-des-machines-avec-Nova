const axios = require('axios');

/**
 * Create a Keystone project (tenant) for multi-tenant isolation.
 * Uses admin token from KEYSTONE_URL.
 * @param {string} projectName - Unique name for the project (e.g. vm-user-{userId})
 * @param {string} adminToken - X-Auth-Token from admin scope
 * @returns {Promise<string|null>} - Project ID or null on failure
 */
async function createProject(projectName, adminToken) {
  if (!process.env.KEYSTONE_URL) return null;
  const url = `${process.env.KEYSTONE_URL}/projects`;
  try {
    const response = await axios.post(
      url,
      {
        project: {
          name: projectName,
          description: `VM Marketplace project for ${projectName}`,
          domain_id: 'default',
          enabled: true
        }
      },
      {
        headers: {
          'X-Auth-Token': adminToken,
          'Content-Type': 'application/json'
        }
      }
    );
    return response.data.project?.id || null;
  } catch (err) {
    console.warn('[Keystone] createProject failed:', err.response?.data || err.message);
    return null;
  }
}

module.exports = { createProject };

const axios = require('axios');

const BASE_URL = 'http://localhost:4000/api';

async function testJobCreation() {
  console.log('🧪 Testing Job Creation Flow...\n');

  try {
    // Step 1: Register Company
    console.log('1. Registering Company...');
    const companyRegResponse = await axios.post(`${BASE_URL}/auth/register/company`, {
      email: 'testcompany@example.com',
      password: 'password123',
      name: 'Test Company',
      website: 'https://testcompany.com',
      about: 'A test company',
      industry: 'Technology',
      logo: 'https://example.com/logo.png'
    });
    
    const companyToken = companyRegResponse.data.token;
    console.log('✅ Company Registered:', companyRegResponse.data.company.name);

    // Step 2: Create Job
    console.log('\n2. Creating Job...');
    const jobResponse = await axios.post(`${BASE_URL}/jobs`, {
      title: 'Senior Developer',
      description: 'We are looking for a senior developer...',
      location: 'Mumbai, India',
      salary: 80000,
      type: 'FULL_TIME'
    }, {
      headers: { Authorization: `Bearer ${companyToken}` }
    });
    
    console.log('✅ Job Created:', jobResponse.data.job.title);
    console.log('Job ID:', jobResponse.data.job.id);

    // Step 3: Get Jobs (Public)
    console.log('\n3. Getting Jobs (Public)...');
    const jobsResponse = await axios.get(`${BASE_URL}/jobs`);
    console.log('✅ Jobs Retrieved:', jobsResponse.data.jobs.length, 'jobs found');

    console.log('\n🎉 Job creation flow completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    console.error('Status:', error.response?.status);
    
    if (error.response?.status === 403) {
      console.log('\n💡 403 Error Tips:');
      console.log('- Make sure you registered a company first');
      console.log('- Use the company token, not user token');
      console.log('- Check that the Authorization header is correct');
      console.log('- Verify the token hasn\'t expired');
    }
  }
}

// Run test
testJobCreation(); 
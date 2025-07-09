const axios = require('axios');

const BASE_URL = 'http://localhost:4000/api';
let userToken = '';
let companyToken = '';
let adminToken = '';

async function testAPI() {
  console.log('🧪 Starting API Tests...\n');

  try {
    // Test 1: Health Check
    console.log('1. Testing Health Check...');
    const healthResponse = await axios.get('http://localhost:4000/');
    console.log('✅ Health Check:', healthResponse.data.message);

    // Test 2: Register User
    console.log('\n2. Testing User Registration...');
    const userRegResponse = await axios.post(`${BASE_URL}/auth/register/user`, {
      email: 'testuser@example.com',
      password: 'password123',
      name: 'Test User',
      skills: 'JavaScript, React, Node.js',
      bio: 'Full-stack developer',
      location: 'Mumbai, India'
    });
    userToken = userRegResponse.data.token;
    console.log('✅ User Registered:', userRegResponse.data.user.name);

    // Test 3: Register Company
    console.log('\n3. Testing Company Registration...');
    const companyRegResponse = await axios.post(`${BASE_URL}/auth/register/company`, {
      email: 'testcompany@example.com',
      password: 'password123',
      name: 'Test Company',
      website: 'https://testcompany.com',
      about: 'A test company',
      industry: 'Technology',
      logo: 'https://example.com/logo.png'
    });
    companyToken = companyRegResponse.data.token;
    console.log('✅ Company Registered:', companyRegResponse.data.company.name);

    // Test 4: Login Admin
    console.log('\n4. Testing Admin Login...');
    const adminLoginResponse = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'admin@jobboard.com',
      password: 'admin123',
      entityType: 'Admin'
    });
    adminToken = adminLoginResponse.data.token;
    console.log('✅ Admin Logged In');

    // Test 5: Create Job (Company)
    console.log('\n5. Testing Job Creation...');
    const jobResponse = await axios.post(`${BASE_URL}/jobs`, {
      title: 'Senior Developer',
      description: 'We are looking for a senior developer...',
      location: 'Mumbai, India',
      salary: 80000,
      type: 'FULL_TIME'
    }, {
      headers: { Authorization: `Bearer ${companyToken}` }
    });
    const jobId = jobResponse.data.job.id;
    console.log('✅ Job Created:', jobResponse.data.job.title);

    // Test 6: Get Jobs (Public)
    console.log('\n6. Testing Get Jobs...');
    const jobsResponse = await axios.get(`${BASE_URL}/jobs`);
    console.log('✅ Jobs Retrieved:', jobsResponse.data.jobs.length, 'jobs found');

    // Test 7: Apply to Job (User)
    console.log('\n7. Testing Job Application...');
    const applicationResponse = await axios.post(`${BASE_URL}/applications`, {
      jobId: jobId,
      resume: 'https://example.com/resume.pdf',
      coverLetter: 'I am excited to apply for this position...'
    }, {
      headers: { Authorization: `Bearer ${userToken}` }
    });
    console.log('✅ Application Submitted');

    // Test 8: Bookmark Job (User)
    console.log('\n8. Testing Job Bookmark...');
    const bookmarkResponse = await axios.post(`${BASE_URL}/bookmarks`, {
      jobId: jobId
    }, {
      headers: { Authorization: `Bearer ${userToken}` }
    });
    console.log('✅ Job Bookmarked');

    // Test 9: Get User Profile
    console.log('\n9. Testing Get User Profile...');
    const userProfileResponse = await axios.get(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${userToken}` }
    });
    console.log('✅ User Profile Retrieved:', userProfileResponse.data.user.name);

    // Test 10: Get Subscription Plans
    console.log('\n10. Testing Get Subscription Plans...');
    const plansResponse = await axios.get(`${BASE_URL}/subscriptions/plans`);
    console.log('✅ Plans Retrieved:', plansResponse.data.plans.length, 'plans found');

    // Test 11: Get Admin Stats
    console.log('\n11. Testing Admin Stats...');
    const statsResponse = await axios.get(`${BASE_URL}/admin/stats`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    console.log('✅ Admin Stats Retrieved');

    console.log('\n🎉 All tests passed successfully!');
    console.log('\n📊 Test Summary:');
    console.log('- ✅ Health Check');
    console.log('- ✅ User Registration & Authentication');
    console.log('- ✅ Company Registration & Authentication');
    console.log('- ✅ Admin Authentication');
    console.log('- ✅ Job Creation');
    console.log('- ✅ Job Listing');
    console.log('- ✅ Job Application');
    console.log('- ✅ Job Bookmarking');
    console.log('- ✅ Profile Management');
    console.log('- ✅ Subscription Plans');
    console.log('- ✅ Admin Dashboard');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    console.error('Status:', error.response?.status);
  }
}

// Run tests
testAPI(); 
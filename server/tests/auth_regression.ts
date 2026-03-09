import axios from "axios";

const BASE_URL = "http://localhost:5000/api/auth";
const TEST_EMAIL = "teacher@example.com"; // Use a known email or mock

async function runTests() {
  console.log("--- Starting Forgot Password Regression Tests ---");

  try {
    // 1. Request Code
    console.log("1. Requesting reset code...");
    const reqRes = await axios.post(
      `${BASE_URL}/teacher/password-reset/request`,
      { email: TEST_EMAIL },
    );
    console.log("Result:", reqRes.data.message);

    // Note: Since we can't easily get the code from Redis/Email in a simple test without DB access,
    // this test assumes you have access to the logs or are running in an environment where you can intercept it.
    // For a real automated test, we would mock redis or use a test DB.

    console.log(
      "NOTE: Manual verification required for code interception if Redis is not accessible.",
    );
  } catch (error: any) {
    console.error("Test failed:", error.response?.data || error.message);
  }
}

// runTests();

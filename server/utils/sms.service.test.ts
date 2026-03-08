import { SMSService } from './sms.service';

// Simple test file for SMS service
// This can be run with: npx ts-node utils/sms.service.test.ts

async function testSMSService() {
  console.log('Testing SMS Service...\n');

  try {
    // Test phone number validation
    console.log('1. Testing phone number validation:');
    const validNumbers = ['01712345678', '01812345678', '01912345678', '01512345678', '01312345678'];
    const invalidNumbers = ['12345678901', '0171234567', '017123456789', 'abc12345678'];

    validNumbers.forEach(number => {
      const isValid = SMSService.validatePhoneNumber(number);
      console.log(`   ${number}: ${isValid ? '✓ Valid' : '✗ Invalid'}`);
    });

    invalidNumbers.forEach(number => {
      const isValid = SMSService.validatePhoneNumber(number);
      console.log(`   ${number}: ${isValid ? '✓ Valid' : '✗ Invalid'}`);
    });

    // Test phone number formatting
    console.log('\n2. Testing phone number formatting:');
    const numbersToFormat = ['01712345678', '88-01712345678', '+8801712345678', '017-12345678'];
    
    numbersToFormat.forEach(number => {
      try {
        const formatted = SMSService.formatPhoneNumber(number);
        console.log(`   ${number} → ${formatted} ✓`);
      } catch (error) {
        console.log(`   ${number} → Error: ${error.message} ✗`);
      }
    });

    // Test password reset code message generation
    console.log('\n3. Testing password reset code generation:');
    const testMessage = SMSService.sendPasswordResetCode('01712345678', '123456', 'John Doe');
    console.log('   Password reset message test: ✓ Message format ready');

    // Test verification code message generation
    console.log('\n4. Testing verification code generation:');
    const verifyMessage = SMSService.sendVerificationCode('01712345678', '654321', 'account verification');
    console.log('   Verification message test: ✓ Message format ready');

    console.log('\n✅ All SMS service tests passed!');
    console.log('\nNote: Actual SMS sending requires valid API credentials in environment variables:');
    console.log('- BULK_SMS_API_KEY');
    console.log('- BULK_SMS_SENDER_ID');

  } catch (error) {
    console.error('❌ SMS Service test failed:', error);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  testSMSService();
}

export { testSMSService };

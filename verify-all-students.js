const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Set all students to email_verified = true
 */
async function verifyAllStudents() {
  console.log('📧 [EMAIL VERIFICATION] Setting all students as verified...\n');
  
  try {
    // First, check current status
    const { count: totalStudents, error: countError } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'student');
      
    if (countError) {
      console.error('❌ Error counting students:', countError);
      return;
    }
    
    console.log(`👥 Total students in database: ${totalStudents || 0}`);
    
    // Check how many are currently unverified
    const { count: unverifiedCount, error: unverifiedError } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'student')
      .eq('email_verified', false);
      
    if (unverifiedError) {
      console.error('❌ Error counting unverified students:', unverifiedError);
      return;
    }
    
    console.log(`📧 Unverified students: ${unverifiedCount || 0}`);
    console.log(`✅ Already verified students: ${(totalStudents || 0) - (unverifiedCount || 0)}`);
    
    if (unverifiedCount === 0) {
      console.log('\n🎉 All students are already verified! Nothing to do.');
      return;
    }
    
    console.log(`\n🔄 Updating ${unverifiedCount} students to verified=true...`);
    
    // Update all students to email_verified = true
    const { data: updatedStudents, error: updateError } = await supabase
      .from('users')
      .update({ 
        email_verified: true,
        updated_at: new Date().toISOString()
      })
      .eq('role', 'student')
      .eq('email_verified', false)
      .select('id, first_name, last_name, email');
    
    if (updateError) {
      console.error('❌ Error updating students:', updateError);
      return;
    }
    
    console.log(`✅ Successfully verified ${updatedStudents?.length || 0} students!`);
    
    // Show some sample updated students
    if (updatedStudents && updatedStudents.length > 0) {
      console.log('\n📋 Sample updated students:');
      updatedStudents.slice(0, 10).forEach((student, index) => {
        console.log(`   ${index + 1}. ${student.first_name} ${student.last_name} (${student.email})`);
      });
      
      if (updatedStudents.length > 10) {
        console.log(`   ... and ${updatedStudents.length - 10} more students`);
      }
    }
    
    // Final verification
    const { count: finalUnverifiedCount, error: finalCountError } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'student')
      .eq('email_verified', false);
      
    if (finalCountError) {
      console.error('❌ Error in final count:', finalCountError);
      return;
    }
    
    console.log(`\n📊 FINAL STATUS:`);
    console.log(`   Total students: ${totalStudents}`);
    console.log(`   Verified students: ${(totalStudents || 0) - (finalUnverifiedCount || 0)}`);
    console.log(`   Unverified students: ${finalUnverifiedCount || 0}`);
    
    if (finalUnverifiedCount === 0) {
      console.log(`\n🎉 SUCCESS! All ${totalStudents} students are now verified!`);
    } else {
      console.log(`\n⚠️  Still ${finalUnverifiedCount} unverified students remaining.`);
    }
    
  } catch (error) {
    console.error('❌ Error during verification update:', error.message);
  }
}

/**
 * Check verification status of all users (optional function)
 */
async function checkVerificationStatus() {
  console.log('🔍 [VERIFICATION STATUS] Checking email verification status...\n');
  
  try {
    const { data: statusSummary, error } = await supabase
      .from('users')
      .select('role, email_verified')
      .in('role', ['student', 'teacher', 'admin']);
      
    if (error) {
      console.error('❌ Error fetching verification status:', error);
      return;
    }
    
    // Group by role and verification status
    const summary = {};
    
    statusSummary?.forEach(user => {
      const role = user.role;
      const verified = user.email_verified ? 'verified' : 'unverified';
      
      if (!summary[role]) {
        summary[role] = { verified: 0, unverified: 0 };
      }
      
      summary[role][verified]++;
    });
    
    console.log('📊 EMAIL VERIFICATION SUMMARY:');
    console.log('='.repeat(50));
    
    Object.keys(summary).forEach(role => {
      const stats = summary[role];
      const total = stats.verified + stats.unverified;
      const percentage = total > 0 ? Math.round((stats.verified / total) * 100) : 0;
      
      console.log(`${role.toUpperCase().padEnd(10)} | ${stats.verified.toString().padStart(3)} verified | ${stats.unverified.toString().padStart(3)} unverified | ${percentage}% verified`);
    });
    
    console.log('='.repeat(50));
    
  } catch (error) {
    console.error('❌ Error checking verification status:', error.message);
  }
}

// Run the script
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--check-only')) {
    checkVerificationStatus().then(() => {
      console.log('\n✅ Status check complete!');
      process.exit(0);
    }).catch(console.error);
  } else {
    console.log('🚀 [EMAIL VERIFICATION] Starting student verification update...\n');
    
    verifyAllStudents().then(() => {
      console.log('\n✅ Email verification update complete!');
      process.exit(0);
    }).catch(console.error);
  }
}

module.exports = {
  verifyAllStudents,
  checkVerificationStatus
};
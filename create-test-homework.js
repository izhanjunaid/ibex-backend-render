const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createTestHomework() {
  console.log('📝 [TEST] Creating test homework for grade section...\n');
  
  const gradeSectionId = '7d454a73-9af2-4a4e-89f3-9d385f69cefb'; // From debug results
  const teacherId = 'your-teacher-id-here'; // You'll need to replace this
  
  try {
    // First, let's find a teacher
    console.log('1️⃣ Finding a teacher...');
    const { data: teachers, error: teacherError } = await supabase
      .from('users')
      .select('id, email, first_name, last_name')
      .eq('role', 'teacher')
      .eq('status', 'active')
      .limit(1);
    
    if (teacherError || !teachers || teachers.length === 0) {
      console.log('❌ No teachers found. Please create a teacher first.');
      return;
    }
    
    const teacher = teachers[0];
    console.log('✅ Found teacher:', {
      id: teacher.id,
      name: `${teacher.first_name} ${teacher.last_name}`,
      email: teacher.email
    });
    
    // Create test homework
    console.log('\n2️⃣ Creating test homework...');
    const testHomework = {
      grade_section_id: gradeSectionId,
      teacher_id: teacher.id,
      title: 'Daily Homework - July 26, 2025',
      content: 'Complete the following assignments for all subjects',
      homework_date: '2025-07-26',
      subjects: [
        {
          subject: 'Mathematics',
          homework: 'Complete exercises 1-10 in Chapter 5',
          due_date: '2025-07-27'
        },
        {
          subject: 'English',
          homework: 'Read Chapter 3 and write a summary',
          due_date: '2025-07-28'
        },
        {
          subject: 'Science',
          homework: 'Complete the lab report for Experiment 2',
          due_date: '2025-07-29'
        }
      ],
      is_published: true
    };
    
    const { data: homework, error: homeworkError } = await supabase
      .from('homework_announcements')
      .insert([testHomework])
      .select()
      .single();
    
    if (homeworkError) {
      console.log('❌ Error creating homework:', homeworkError);
      return;
    }
    
    console.log('✅ Test homework created successfully!');
    console.log('📊 Homework details:', {
      id: homework.id,
      title: homework.title,
      date: homework.homework_date,
      published: homework.is_published,
      subjects: homework.subjects.length
    });
    
    // Test the function again
    console.log('\n3️⃣ Testing get_student_homework function again...');
    const studentId = '272fce50-d4c1-44ef-bb10-57ea44da2dc5';
    const startDate = '2025-07-26';
    const endDate = '2025-08-25';
    
    const { data: functionResult, error: functionError } = await supabase
      .rpc('get_student_homework', {
        student_uuid: studentId,
        start_date: startDate,
        end_date: endDate
      });
    
    if (functionError) {
      console.log('❌ Function error:', functionError);
      return;
    }
    
    console.log(`📊 Function result: ${functionResult.length} homework items`);
    functionResult.forEach((hw, index) => {
      console.log(`   ${index + 1}. ${hw.title || 'No title'} (${hw.homework_date})`);
      console.log(`      - Teacher: ${hw.teacher_name}`);
      console.log(`      - PDF URL: ${hw.pdf_url || 'No PDF'}`);
    });
    
    console.log('\n🎉 Success! The student should now see homework when they make requests.');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the function
createTestHomework(); 
# 🔥 **Complete Firebase Setup Guide**

Based on your Firebase service account JSON file, here's exactly what you need to do to get push notifications working.

## 📋 **Your Firebase Project Details**

- **Project ID**: `ibex-a6bcd`
- **Client Email**: `firebase-adminsdk-fbsvc@ibex-a6bcd.iam.gserviceaccount.com`
- **Private Key ID**: `4944bcb6c1043b2a981529884985168647c5e7db`

---

## 🚀 **Step-by-Step Setup**

### **Step 1: Get Firebase Server Key**

1. **Go to Firebase Console**: https://console.firebase.google.com/
2. **Select your project**: `ibex-a6bcd`
3. **Go to Project Settings**: Click the gear icon ⚙️ next to "Project Overview"
4. **Click "Cloud Messaging" tab**
5. **Enable Legacy API**:
   - Find "Cloud Messaging API (Legacy)"
   - Click "Enable" (temporarily)
   - A "Server key" field will appear
6. **Copy the Server Key**: Click "Copy" next to the server key

### **Step 2: Set Environment Variables**

Add the server key to your environment:

```bash
# In your .env file
FIREBASE_SERVER_KEY=AAAA1234567890abcdefghijklmnopqrstuvwxyz
```

### **Step 3: Deploy Supabase Edge Function**

```bash
# Deploy the push notifications function
npx supabase functions deploy push-notifications

# Set the environment variable in Supabase
npx supabase secrets set FIREBASE_SERVER_KEY=your_server_key_here
```

### **Step 4: Test the System**

```bash
# Run the test script
node test-push-notifications.js

# Or test manually
node extract-firebase-server-key.js
```

---

## 📱 **Android App Setup**

### **Step 1: Add google-services.json**

1. **Download google-services.json** from Firebase Console:
   - Go to Project Settings
   - Click "Add app" → Android
   - Enter package name: `com.yourcompany.yourapp`
   - Download the file

2. **Place in Android project**:
   ```
   YourAndroidProject/
   ├── app/
   │   ├── google-services.json  ← Place here
   │   └── build.gradle
   ```

### **Step 2: Configure build.gradle**

**Project-level build.gradle**:
```gradle
buildscript {
    dependencies {
        classpath 'com.google.gms:google-services:4.4.0'
    }
}
```

**App-level build.gradle**:
```gradle
plugins {
    id 'com.android.application'
    id 'com.google.gms.google-services'
}

dependencies {
    implementation platform('com.google.firebase:firebase-bom:32.7.0')
    implementation 'com.google.firebase:firebase-messaging'
    implementation 'com.google.firebase:firebase-analytics'
}
```

### **Step 3: Implement FCM Service**

Follow the complete implementation in `ANDROID_PUSH_NOTIFICATIONS_GUIDE.md`

---

## 🧪 **Testing Commands**

### **Test FCM Token Registration**
```bash
curl -X POST https://your-backend.com/api/notifications/register-token \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "token": "test_fcm_token_123",
    "deviceType": "android",
    "deviceName": "Test Device"
  }'
```

### **Test Attendance Notification**
```bash
curl -X POST https://your-backend.com/api/notifications/send-attendance \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "studentId": "student_uuid_here",
    "status": "present",
    "date": "2025-01-15",
    "gradeSectionName": "Grade 10-A"
  }'
```

### **Test Complete Flow**
```bash
curl -X POST https://your-backend.com/api/attendance/bulk-mark \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "grade_section_id": "grade_section_uuid",
    "date": "2025-01-15",
    "attendance_records": [
      {
        "student_id": "student_uuid_1",
        "status": "present"
      }
    ]
  }'
```

---

## 🔧 **Environment Variables Summary**

```bash
# Required Environment Variables
FIREBASE_SERVER_KEY=your_firebase_server_key_here
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Optional
NODE_ENV=production
```

---

## 🎯 **Expected Results**

### **When Everything Works:**
1. ✅ FCM token registered successfully
2. ✅ Push notification function deployed
3. ✅ Attendance marking triggers notifications
4. ✅ Android device receives pop-up notification:
   ```
   ✅ Attendance Marked
   Hi John! Your attendance has been marked as Present for 1/15/2025 in Grade 10-A.
   ```

---

## 🔍 **Troubleshooting**

### **Issue: "Firebase Server Key not configured"**
**Solution**: Make sure `FIREBASE_SERVER_KEY` is set in your environment

### **Issue: "Invalid server key"**
**Solution**: 
1. Double-check the server key from Firebase Console
2. Make sure there are no extra spaces
3. Regenerate the key if needed

### **Issue: "No notifications received"**
**Solution**:
1. Check device notification settings
2. Verify FCM token is registered with backend
3. Test with Firebase Console's "Send test message"

### **Issue: "Edge Function deployment failed"**
**Solution**:
1. Check Supabase CLI is installed: `npm install -g supabase`
2. Login to Supabase: `supabase login`
3. Link your project: `supabase link --project-ref your-project-ref`

---

## 🎉 **Success Checklist**

- [ ] Firebase project configured (`ibex-a6bcd`)
- [ ] Server key obtained from Firebase Console
- [ ] Environment variables set
- [ ] Supabase Edge Function deployed
- [ ] Database migration applied
- [ ] Android app configured with google-services.json
- [ ] FCM token registration working
- [ ] Test notification received

---

## 📞 **Quick Commands**

```bash
# Extract Firebase details
node extract-firebase-server-key.js

# Test the system
node test-push-notifications.js

# Deploy Edge Function
npx supabase functions deploy push-notifications

# Set environment variable
npx supabase secrets set FIREBASE_SERVER_KEY=your_key_here
```

Your Firebase setup is almost complete! Just need to get that server key and you'll be ready to send beautiful push notifications to students. 🚀

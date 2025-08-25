# 🔥 Android FCM Setup Guide

## **Step 1: Add Firebase to Your Android App**

### **1.1 Add Firebase SDK**
Add these dependencies to your `app/build.gradle`:

```gradle
dependencies {
    // Firebase Cloud Messaging
    implementation 'com.google.firebase:firebase-messaging:23.4.0'
    
    // Firebase Analytics (optional but recommended)
    implementation 'com.google.firebase:firebase-analytics:21.5.0'
}
```

### **1.2 Add google-services.json**
1. Download `google-services.json` from Firebase Console
2. Place it in your `app/` directory
3. Add to your project-level `build.gradle`:

```gradle
buildscript {
    dependencies {
        classpath 'com.google.gms:google-services:4.4.0'
    }
}
```

4. Add to your app-level `build.gradle`:

```gradle
plugins {
    id 'com.google.gms.google-services'
}
```

---

## **Step 2: Create FCM Service**

### **2.1 Create MyFirebaseMessagingService.kt**

```kotlin
package com.yourpackage.yourapp

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.RingtoneManager
import android.os.Build
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

class MyFirebaseMessagingService : FirebaseMessagingService() {

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        // Send token to your server
        sendRegistrationToServer(token)
    }

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        super.onMessageReceived(remoteMessage)
        
        // Handle notification
        remoteMessage.notification?.let { notification ->
            sendNotification(notification.title, notification.body)
        }
        
        // Handle data payload
        remoteMessage.data.isNotEmpty().let {
            // Handle custom data
            val attendanceStatus = remoteMessage.data["status"]
            val date = remoteMessage.data["date"]
            // Process attendance data
        }
    }

    private fun sendRegistrationToServer(token: String) {
        // Send token to your Supabase Edge Function
        // This will be implemented in the next step
    }

    private fun sendNotification(title: String?, body: String?) {
        val intent = Intent(this, MainActivity::class.java)
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
        
        val pendingIntent = PendingIntent.getActivity(
            this, 0, intent,
            PendingIntent.FLAG_ONE_SHOT or PendingIntent.FLAG_IMMUTABLE
        )

        val channelId = "attendance_notifications"
        val defaultSoundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
        
        val notificationBuilder = NotificationCompat.Builder(this, channelId)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(true)
            .setSound(defaultSoundUri)
            .setContentIntent(pendingIntent)

        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        // Create notification channel for Android O and above
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                channelId,
                "Attendance Notifications",
                NotificationManager.IMPORTANCE_HIGH
            )
            notificationManager.createNotificationChannel(channel)
        }

        notificationManager.notify(0, notificationBuilder.build())
    }
}
```

### **2.2 Add to AndroidManifest.xml**

```xml
<service
    android:name=".MyFirebaseMessagingService"
    android:exported="false">
    <intent-filter>
        <action android:name="com.google.firebase.MESSAGING_EVENT" />
    </intent-filter>
</service>
```

---

## **Step 3: Token Registration**

### **3.1 Create FCM Token Manager**

```kotlin
package com.yourpackage.yourapp

import android.content.Context
import android.util.Log
import com.google.firebase.messaging.FirebaseMessaging
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.IOException

class FCMTokenManager(private val context: Context) {
    
    private val client = OkHttpClient()
    private val edgeFunctionUrl = "https://ngbpndbjxmhffhcpkgas.supabase.co/functions/v1/push-notifications"
    
    fun registerToken(jwtToken: String) {
        FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
            if (task.isSuccessful) {
                val token = task.result
                Log.d("FCM", "Token: $token")
                sendTokenToServer(token, jwtToken)
            } else {
                Log.e("FCM", "Failed to get token", task.exception)
            }
        }
    }
    
    private fun sendTokenToServer(fcmToken: String, jwtToken: String) {
        val json = JSONObject().apply {
            put("action", "register-token")
            put("data", JSONObject().apply {
                put("token", fcmToken)
                put("deviceType", "android")
                put("deviceName", android.os.Build.MODEL)
            })
        }
        
        val requestBody = json.toString().toRequestBody("application/json".toMediaType())
        
        val request = Request.Builder()
            .url(edgeFunctionUrl)
            .addHeader("Authorization", "Bearer $jwtToken")
            .addHeader("Content-Type", "application/json")
            .post(requestBody)
            .build()
        
        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                Log.e("FCM", "Failed to register token", e)
            }
            
            override fun onResponse(call: Call, response: Response) {
                val responseBody = response.body?.string()
                Log.d("FCM", "Token registration response: $responseBody")
            }
        })
    }
}
```

### **3.2 Use in Your Activity**

```kotlin
class MainActivity : AppCompatActivity() {
    
    private lateinit var fcmTokenManager: FCMTokenManager
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        
        fcmTokenManager = FCMTokenManager(this)
        
        // Register FCM token when user logs in
        val jwtToken = "YOUR_JWT_TOKEN_HERE" // Get from your auth system
        fcmTokenManager.registerToken(jwtToken)
    }
}
```

---

## **Step 4: Handle Attendance Notifications**

### **4.1 Update MyFirebaseMessagingService.kt**

```kotlin
override fun onMessageReceived(remoteMessage: RemoteMessage) {
    super.onMessageReceived(remoteMessage)
    
    // Handle notification
    remoteMessage.notification?.let { notification ->
        sendNotification(notification.title, notification.body)
    }
    
    // Handle attendance data
    if (remoteMessage.data["type"] == "attendance") {
        val status = remoteMessage.data["status"]
        val date = remoteMessage.data["date"]
        val gradeSection = remoteMessage.data["grade_section_name"]
        
        // Show attendance notification
        showAttendanceNotification(status, date, gradeSection)
        
        // Update UI if app is open
        updateAttendanceUI(status, date, gradeSection)
    }
}

private fun showAttendanceNotification(status: String?, date: String?, gradeSection: String?) {
    val title = when (status) {
        "present" -> "✅ Attendance Marked"
        "absent" -> "❌ Attendance Marked"
        "late" -> "⏰ Attendance Marked"
        else -> "📊 Attendance Marked"
    }
    
    val body = "Your attendance has been marked as ${status?.capitalize()} for $date"
    
    sendNotification(title, body)
}

private fun updateAttendanceUI(status: String?, date: String?, gradeSection: String?) {
    // Update your app's UI to show attendance status
    // This could be a toast, dialog, or update to a list
}
```

---

## **Step 5: Testing**

### **5.1 Test Token Registration**
1. Run your app
2. Check logs for FCM token
3. Verify token is sent to server
4. Check Supabase database for token entry

### **5.2 Test Notifications**
1. Use the cURL commands from our test script
2. Send a test attendance notification
3. Verify notification appears on device
4. Check notification history in database

---

## **Step 6: Integration with Your App**

### **6.1 Add to Login Success**
```kotlin
// After successful login
fcmTokenManager.registerToken(jwtToken)
```

### **6.2 Add to Logout**
```kotlin
// When user logs out
FirebaseMessaging.getInstance().deleteToken()
```

### **6.3 Handle Token Refresh**
```kotlin
// The onNewToken method in MyFirebaseMessagingService
// will automatically handle token refresh
```

---

## **🎯 Next Steps**

1. **Add Firebase SDK** to your Android project
2. **Create the FCM service** files
3. **Test token registration**
4. **Test notifications**
5. **Integrate with your existing app**

Your backend is ready! Now you just need to add these Android components to receive the notifications! 🚀

# 📱 **Student App - Google Play Store Standard Guide**

## 🎯 **App Overview**

A comprehensive student mobile application that allows students to:
- **View daily homework** for their grade section
- **Download PDF homework files**
- **Track academic progress**
- **Receive notifications**
- **Access school resources**

---

## 🏗️ **Technical Architecture**

### **Backend Stack**
- **API**: Node.js + Express.js
- **Database**: Supabase (PostgreSQL)
- **Authentication**: JWT + Supabase Auth
- **File Storage**: Hybrid Storage (Supabase + Cloudflare R2)
- **Real-time**: Supabase Realtime

### **Frontend Stack (Recommended)**
- **Framework**: React Native / Flutter
- **State Management**: Redux / Provider
- **HTTP Client**: Axios / Dio
- **Local Storage**: AsyncStorage / SharedPreferences
- **Push Notifications**: Firebase Cloud Messaging

---

## 🔐 **Authentication Flow**

### **1. Student Login**
```javascript
// Frontend Implementation
const loginStudent = async (email, password) => {
  try {
    const response = await axios.post('http://your-backend.com/api/auth/login', {
      email,
      password
    });
    
    const { token, user } = response.data;
    
    // Store token locally
    await AsyncStorage.setItem('authToken', token);
    await AsyncStorage.setItem('userData', JSON.stringify(user));
    
    return { success: true, user };
  } catch (error) {
    return { success: false, error: error.response?.data?.message };
  }
};
```

### **2. Token Management**
```javascript
// Add token to all requests
axios.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle token expiration
axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await AsyncStorage.removeItem('authToken');
      // Redirect to login
      navigation.navigate('Login');
    }
    return Promise.reject(error);
  }
);
```

---

## 📚 **Core Student Workflows**

### **Workflow 1: Student Onboarding**

#### **Step 1: Login Screen**
```javascript
const LoginScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    const result = await loginStudent(email, password);
    
    if (result.success) {
      navigation.replace('Dashboard');
    } else {
      Alert.alert('Login Failed', result.error);
    }
    setLoading(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Student Login</Text>
      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <TextInput
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <TouchableOpacity onPress={handleLogin} disabled={loading}>
        <Text>{loading ? 'Logging in...' : 'Login'}</Text>
      </TouchableOpacity>
    </View>
  );
};
```

#### **Step 2: Dashboard Screen**
```javascript
const DashboardScreen = () => {
  const [user, setUser] = useState(null);
  const [homework, setHomework] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      // Load user data
      const userData = await AsyncStorage.getItem('userData');
      setUser(JSON.parse(userData));

      // Load homework
      const homeworkResponse = await axios.get('/api/homework/student');
      setHomework(homeworkResponse.data);
    } catch (error) {
      console.error('Dashboard load error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.welcomeText}>
          Welcome, {user?.first_name} {user?.last_name}
        </Text>
        <Text style={styles.gradeText}>
          Grade {user?.grade_level} {user?.section}
        </Text>
      </View>

      <View style={styles.homeworkSection}>
        <Text style={styles.sectionTitle}>Today's Homework</Text>
        {homework.length > 0 ? (
          homework.map((hw) => (
            <HomeworkCard key={hw.homework_id} homework={hw} />
          ))
        ) : (
          <Text style={styles.noHomework}>No homework for today!</Text>
        )}
      </View>
    </ScrollView>
  );
};
```

### **Workflow 2: Homework Viewing**

#### **Homework Card Component**
```javascript
const HomeworkCard = ({ homework }) => {
  const [downloading, setDownloading] = useState(false);

  const downloadPDF = async () => {
    if (!homework.pdf_url) {
      Alert.alert('No PDF available');
      return;
    }

    setDownloading(true);
    try {
      const response = await axios.get(homework.pdf_url, {
        responseType: 'blob'
      });

      // Save PDF to device
      const filePath = `${RNFS.DocumentDirectoryPath}/homework_${homework.homework_date}.pdf`;
      await RNFS.writeFile(filePath, response.data, 'base64');
      
      // Open PDF
      await FileViewer.open(filePath);
    } catch (error) {
      Alert.alert('Download Failed', 'Could not download PDF');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <View style={styles.homeworkCard}>
      <View style={styles.homeworkHeader}>
        <Text style={styles.homeworkTitle}>
          {homework.title || 'Daily Homework'}
        </Text>
        <Text style={styles.homeworkDate}>
          {new Date(homework.homework_date).toLocaleDateString()}
        </Text>
      </View>

      <Text style={styles.teacherName}>
        By: {homework.teacher_name}
      </Text>

      {homework.content && (
        <Text style={styles.homeworkContent}>{homework.content}</Text>
      )}

      {homework.subjects && homework.subjects.length > 0 && (
        <View style={styles.subjectsContainer}>
          <Text style={styles.subjectsTitle}>Subjects:</Text>
          {homework.subjects.map((subject, index) => (
            <View key={index} style={styles.subjectItem}>
              <Text style={styles.subjectName}>{subject.subject}</Text>
              <Text style={styles.subjectHomework}>{subject.homework}</Text>
            </View>
          ))}
        </View>
      )}

      {homework.pdf_url && (
        <TouchableOpacity 
          style={styles.downloadButton}
          onPress={downloadPDF}
          disabled={downloading}
        >
          <Icon name="download" size={20} color="white" />
          <Text style={styles.downloadText}>
            {downloading ? 'Downloading...' : 'Download PDF'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};
```

### **Workflow 3: Profile Management**

#### **Profile Screen**
```javascript
const ProfileScreen = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    try {
      const userData = await AsyncStorage.getItem('userData');
      setUser(JSON.parse(userData));
    } catch (error) {
      console.error('Profile load error:', error);
    }
  };

  const updateProfile = async (updates) => {
    setLoading(true);
    try {
      const response = await axios.put('/api/users/profile', updates);
      const updatedUser = response.data;
      
      await AsyncStorage.setItem('userData', JSON.stringify(updatedUser));
      setUser(updatedUser);
      
      Alert.alert('Success', 'Profile updated successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    await AsyncStorage.removeItem('authToken');
    await AsyncStorage.removeItem('userData');
    navigation.replace('Login');
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.profileHeader}>
        <Image 
          source={{ uri: user?.profile_image_url || 'default_avatar' }}
          style={styles.profileImage}
        />
        <Text style={styles.profileName}>
          {user?.first_name} {user?.last_name}
        </Text>
        <Text style={styles.profileEmail}>{user?.email}</Text>
      </View>

      <View style={styles.profileSection}>
        <Text style={styles.sectionTitle}>Personal Information</Text>
        <ProfileField 
          label="First Name"
          value={user?.first_name}
          onUpdate={(value) => updateProfile({ first_name: value })}
        />
        <ProfileField 
          label="Last Name"
          value={user?.last_name}
          onUpdate={(value) => updateProfile({ last_name: value })}
        />
        <ProfileField 
          label="Phone"
          value={user?.phone}
          onUpdate={(value) => updateProfile({ phone: value })}
        />
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={logout}>
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};
```

---

## 🔌 **Complete API Integration**

### **API Client Setup**
```javascript
// api/client.js
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'http://your-backend.com/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

// Request interceptor
apiClient.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await AsyncStorage.removeItem('authToken');
      await AsyncStorage.removeItem('userData');
      // Navigate to login
    }
    return Promise.reject(error);
  }
);

export default apiClient;
```

### **Authentication APIs**
```javascript
// api/auth.js
import apiClient from './client';

export const authAPI = {
  // Login student
  login: (email, password) => 
    apiClient.post('/auth/login', { email, password }),

  // Register student (if needed)
  register: (userData) => 
    apiClient.post('/auth/register', userData),

  // Logout
  logout: () => 
    apiClient.post('/auth/logout'),

  // Refresh token
  refreshToken: (refreshToken) => 
    apiClient.post('/auth/refresh', { refreshToken }),

  // Get current user
  getCurrentUser: () => 
    apiClient.get('/auth/me'),
};
```

### **Homework APIs**
```javascript
// api/homework.js
import apiClient from './client';

export const homeworkAPI = {
  // Get homework for current student
  getStudentHomework: (startDate, endDate) => 
    apiClient.get('/homework/student', {
      params: { start_date: startDate, end_date: endDate }
    }),

  // Get homework for specific grade section
  getGradeSectionHomework: (gradeSectionId) => 
    apiClient.get(`/homework/grade-section/${gradeSectionId}`),

  // Get specific homework details
  getHomeworkDetails: (homeworkId) => 
    apiClient.get(`/homework/${homeworkId}`),

  // Download PDF file
  downloadPDF: (fileUrl) => 
    apiClient.get(fileUrl, { responseType: 'blob' }),
};
```

### **User Profile APIs**
```javascript
// api/user.js
import apiClient from './client';

export const userAPI = {
  // Get user profile
  getProfile: () => 
    apiClient.get('/users/profile'),

  // Update user profile
  updateProfile: (updates) => 
    apiClient.put('/users/profile', updates),

  // Change password
  changePassword: (currentPassword, newPassword) => 
    apiClient.put('/users/password', {
      current_password: currentPassword,
      new_password: newPassword
    }),

  // Upload profile image
  uploadProfileImage: (imageFile) => {
    const formData = new FormData();
    formData.append('profile_image', imageFile);
    return apiClient.post('/users/profile-image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
};
```

### **Grade Section APIs**
```javascript
// api/gradeSections.js
import apiClient from './client';

export const gradeSectionAPI = {
  // Get student's grade sections
  getStudentGradeSections: () => 
    apiClient.get('/grade-sections/student'),

  // Get grade section details
  getGradeSectionDetails: (gradeSectionId) => 
    apiClient.get(`/grade-sections/${gradeSectionId}`),

  // Get students in grade section
  getGradeSectionStudents: (gradeSectionId) => 
    apiClient.get(`/grade-sections/${gradeSectionId}/students`),
};
```

---

## 📱 **App Screens & Navigation**

### **Navigation Structure**
```javascript
// navigation/AppNavigator.js
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

const MainTabs = () => (
  <Tab.Navigator>
    <Tab.Screen name="Dashboard" component={DashboardScreen} />
    <Tab.Screen name="Homework" component={HomeworkScreen} />
    <Tab.Screen name="Profile" component={ProfileScreen} />
  </Tab.Navigator>
);

const AppNavigator = () => (
  <NavigationContainer>
    <Stack.Navigator>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Main" component={MainTabs} />
    </Stack.Navigator>
  </NavigationContainer>
);
```

### **Screen Components**

#### **Login Screen**
```javascript
const LoginScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }

    setLoading(true);
    try {
      const response = await authAPI.login(email, password);
      const { token, user } = response.data;

      await AsyncStorage.setItem('authToken', token);
      await AsyncStorage.setItem('userData', JSON.stringify(user));

      navigation.replace('Main');
    } catch (error) {
      Alert.alert('Login Failed', error.response?.data?.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.logoContainer}>
        <Image source={require('../assets/logo.png')} style={styles.logo} />
        <Text style={styles.appName}>Student Portal</Text>
      </View>

      <View style={styles.formContainer}>
        <TextInput
          style={styles.input}
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        <TouchableOpacity 
          style={[styles.loginButton, loading && styles.disabledButton]}
          onPress={handleLogin}
          disabled={loading}
        >
          <Text style={styles.loginButtonText}>
            {loading ? 'Logging in...' : 'Login'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};
```

#### **Homework List Screen**
```javascript
const HomeworkScreen = () => {
  const [homework, setHomework] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadHomework();
  }, []);

  const loadHomework = async () => {
    try {
      const startDate = new Date().toISOString().split('T')[0];
      const endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      const response = await homeworkAPI.getStudentHomework(startDate, endDate);
      setHomework(response.data);
    } catch (error) {
      console.error('Homework load error:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadHomework();
    setRefreshing(false);
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <FlatList
      data={homework}
      renderItem={({ item }) => <HomeworkCard homework={item} />}
      keyExtractor={(item) => item.homework_id}
      refreshing={refreshing}
      onRefresh={onRefresh}
      ListEmptyComponent={
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No homework available</Text>
        </View>
      }
    />
  );
};
```

---

## 🔔 **Push Notifications**

### **Notification Setup**
```javascript
// services/notifications.js
import messaging from '@react-native-firebase/messaging';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const notificationService = {
  // Request permission
  requestPermission: async () => {
    const authStatus = await messaging().requestPermission();
    const enabled = authStatus === messaging.AuthorizationStatus.AUTHORIZED;
    
    if (enabled) {
      const token = await messaging().getToken();
      await AsyncStorage.setItem('fcmToken', token);
      
      // Send token to backend
      await apiClient.post('/users/fcm-token', { token });
    }
    
    return enabled;
  },

  // Handle foreground messages
  onMessageReceived: (callback) => {
    return messaging().onMessage(callback);
  },

  // Handle background messages
  onBackgroundMessage: (callback) => {
    return messaging().setBackgroundMessageHandler(callback);
  },

  // Handle notification tap
  onNotificationOpenedApp: (callback) => {
    return messaging().onNotificationOpenedApp(callback);
  },
};
```

### **Notification Usage**
```javascript
// App.js
import { notificationService } from './services/notifications';

const App = () => {
  useEffect(() => {
    // Request permission
    notificationService.requestPermission();

    // Handle foreground messages
    const unsubscribe = notificationService.onMessageReceived((message) => {
      // Show local notification
      showLocalNotification(message);
    });

    return unsubscribe;
  }, []);

  return <AppNavigator />;
};
```

---

## 💾 **Local Storage & Caching**

### **Storage Service**
```javascript
// services/storage.js
import AsyncStorage from '@react-native-async-storage/async-storage';

export const storageService = {
  // Store data
  setItem: async (key, value) => {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error('Storage set error:', error);
    }
  },

  // Get data
  getItem: async (key) => {
    try {
      const value = await AsyncStorage.getItem(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Storage get error:', error);
      return null;
    }
  },

  // Remove data
  removeItem: async (key) => {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error('Storage remove error:', error);
    }
  },

  // Clear all data
  clear: async () => {
    try {
      await AsyncStorage.clear();
    } catch (error) {
      console.error('Storage clear error:', error);
    }
  },
};
```

### **Cache Service**
```javascript
// services/cache.js
import { storageService } from './storage';

export const cacheService = {
  // Cache homework data
  cacheHomework: async (homework) => {
    await storageService.setItem('cached_homework', {
      data: homework,
      timestamp: Date.now()
    });
  },

  // Get cached homework
  getCachedHomework: async () => {
    const cached = await storageService.getItem('cached_homework');
    if (cached && Date.now() - cached.timestamp < 30 * 60 * 1000) { // 30 minutes
      return cached.data;
    }
    return null;
  },

  // Cache user profile
  cacheUserProfile: async (profile) => {
    await storageService.setItem('cached_profile', {
      data: profile,
      timestamp: Date.now()
    });
  },

  // Get cached profile
  getCachedProfile: async () => {
    const cached = await storageService.getItem('cached_profile');
    if (cached && Date.now() - cached.timestamp < 60 * 60 * 1000) { // 1 hour
      return cached.data;
    }
    return null;
  },
};
```

---

## 🎨 **UI/UX Guidelines**

### **Color Scheme**
```javascript
// styles/colors.js
export const colors = {
  primary: '#2563EB',      // Blue
  secondary: '#64748B',    // Gray
  success: '#10B981',      // Green
  warning: '#F59E0B',      // Yellow
  error: '#EF4444',        // Red
  background: '#F8FAFC',   // Light gray
  surface: '#FFFFFF',      // White
  text: '#1E293B',         // Dark gray
  textSecondary: '#64748B', // Medium gray
  border: '#E2E8F0',       // Light border
};
```

### **Typography**
```javascript
// styles/typography.js
export const typography = {
  h1: {
    fontSize: 32,
    fontWeight: 'bold',
    lineHeight: 40,
  },
  h2: {
    fontSize: 24,
    fontWeight: 'bold',
    lineHeight: 32,
  },
  h3: {
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 28,
  },
  body: {
    fontSize: 16,
    fontWeight: 'normal',
    lineHeight: 24,
  },
  caption: {
    fontSize: 14,
    fontWeight: 'normal',
    lineHeight: 20,
  },
  small: {
    fontSize: 12,
    fontWeight: 'normal',
    lineHeight: 16,
  },
};
```

### **Component Styles**
```javascript
// styles/components.js
import { colors } from './colors';
import { typography } from './typography';

export const componentStyles = {
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: colors.surface,
    fontSize: 16,
    fontWeight: '600',
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    marginVertical: 8,
  },
};
```

---

## 🔒 **Security Best Practices**

### **Data Encryption**
```javascript
// services/encryption.js
import CryptoJS from 'crypto-js';

const SECRET_KEY = 'your-secret-key';

export const encryptionService = {
  // Encrypt sensitive data
  encrypt: (data) => {
    return CryptoJS.AES.encrypt(JSON.stringify(data), SECRET_KEY).toString();
  },

  // Decrypt sensitive data
  decrypt: (encryptedData) => {
    const bytes = CryptoJS.AES.decrypt(encryptedData, SECRET_KEY);
    return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
  },

  // Hash passwords
  hashPassword: (password) => {
    return CryptoJS.SHA256(password).toString();
  },
};
```

### **Secure Storage**
```javascript
// services/secureStorage.js
import EncryptedStorage from 'react-native-encrypted-storage';

export const secureStorageService = {
  // Store sensitive data
  setSecureItem: async (key, value) => {
    try {
      await EncryptedStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error('Secure storage set error:', error);
    }
  },

  // Get sensitive data
  getSecureItem: async (key) => {
    try {
      const value = await EncryptedStorage.getItem(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Secure storage get error:', error);
      return null;
    }
  },

  // Remove sensitive data
  removeSecureItem: async (key) => {
    try {
      await EncryptedStorage.removeItem(key);
    } catch (error) {
      console.error('Secure storage remove error:', error);
    }
  },
};
```

---

## 🧪 **Testing Strategy**

### **Unit Tests**
```javascript
// __tests__/api/homework.test.js
import { homeworkAPI } from '../../api/homework';
import apiClient from '../../api/client';

jest.mock('../../api/client');

describe('Homework API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('getStudentHomework should fetch homework data', async () => {
    const mockResponse = {
      data: [
        {
          homework_id: '1',
          title: 'Math Homework',
          homework_date: '2025-01-15',
          teacher_name: 'John Doe'
        }
      ]
    };

    apiClient.get.mockResolvedValue(mockResponse);

    const result = await homeworkAPI.getStudentHomework('2025-01-01', '2025-01-31');
    
    expect(apiClient.get).toHaveBeenCalledWith('/homework/student', {
      params: { start_date: '2025-01-01', end_date: '2025-01-31' }
    });
    expect(result.data).toEqual(mockResponse.data);
  });
});
```

### **Integration Tests**
```javascript
// __tests__/integration/auth.test.js
import { authAPI } from '../../api/auth';
import { storageService } from '../../services/storage';

describe('Authentication Integration', () => {
  test('login should store token and user data', async () => {
    const mockResponse = {
      data: {
        token: 'mock-token',
        user: { id: '1', email: 'test@example.com' }
      }
    };

    // Mock API response
    jest.spyOn(authAPI, 'login').mockResolvedValue(mockResponse);
    
    // Mock storage
    jest.spyOn(storageService, 'setItem').mockResolvedValue();

    const result = await authAPI.login('test@example.com', 'password');
    
    expect(storageService.setItem).toHaveBeenCalledWith('authToken', 'mock-token');
    expect(storageService.setItem).toHaveBeenCalledWith('userData', JSON.stringify(mockResponse.data.user));
  });
});
```

---

## 📦 **App Store Preparation**

### **App Configuration**
```javascript
// app.json (React Native)
{
  "expo": {
    "name": "Student Portal",
    "slug": "student-portal",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#2563EB"
    },
    "updates": {
      "fallbackToCacheTimeout": 0
    },
    "assetBundlePatterns": [
      "**/*"
    ],
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.yourcompany.studentportal"
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#2563EB"
      },
      "package": "com.yourcompany.studentportal",
      "permissions": [
        "INTERNET",
        "READ_EXTERNAL_STORAGE",
        "WRITE_EXTERNAL_STORAGE",
        "CAMERA"
      ]
    },
    "web": {
      "favicon": "./assets/favicon.png"
    }
  }
}
```

### **Privacy Policy Requirements**
- Data collection and usage
- Third-party services
- User rights and controls
- Data retention policies
- Contact information

### **App Store Screenshots**
- Login screen
- Dashboard with homework
- PDF viewer
- Profile screen
- Settings screen

---

## 🚀 **Deployment Checklist**

### **Pre-Launch**
- [ ] Complete all CRUD operations
- [ ] Implement error handling
- [ ] Add loading states
- [ ] Test offline functionality
- [ ] Implement push notifications
- [ ] Add analytics tracking
- [ ] Test on multiple devices
- [ ] Performance optimization
- [ ] Security audit
- [ ] Privacy policy compliance

### **Launch**
- [ ] Submit to Google Play Store
- [ ] Monitor crash reports
- [ ] Track user analytics
- [ ] Gather user feedback
- [ ] Plan feature updates

---

## 📊 **Analytics & Monitoring**

### **Analytics Setup**
```javascript
// services/analytics.js
import analytics from '@react-native-firebase/analytics';

export const analyticsService = {
  // Track screen views
  trackScreen: (screenName) => {
    analytics().logScreenView({
      screen_name: screenName,
      screen_class: screenName,
    });
  },

  // Track user actions
  trackEvent: (eventName, parameters = {}) => {
    analytics().logEvent(eventName, parameters);
  },

  // Track homework downloads
  trackHomeworkDownload: (homeworkId, homeworkTitle) => {
    analytics().logEvent('homework_download', {
      homework_id: homeworkId,
      homework_title: homeworkTitle,
    });
  },

  // Track login events
  trackLogin: (method) => {
    analytics().logEvent('login', {
      method: method,
    });
  },
};
```

---

## 🎯 **Summary**

This comprehensive guide provides everything needed to build a Google Play Store standard student app:

1. **Complete authentication flow**
2. **All CRUD operations for students**
3. **Homework viewing and downloading**
4. **Profile management**
5. **Push notifications**
6. **Local storage and caching**
7. **Security best practices**
8. **Testing strategies**
9. **App store preparation**
10. **Analytics and monitoring**

The app follows modern mobile development best practices and provides a smooth, secure experience for students to access their homework and school resources.

**Ready to build your student app! 🚀** 
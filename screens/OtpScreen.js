import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { db, doc, setDoc, getDoc } from '../lib/firebase';

export default function OtpScreen({ route, navigation }) {
  const { phoneNumber, confirmationResult } = route.params || {};
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);

  const handleVerify = async () => {
    if (!otp || otp.length < 6) {
      Alert.alert('Invalid OTP', 'Please enter a valid 6-digit OTP code.');
      return;
    }

    setLoading(true);
    try {
      let userId = `user_${Date.now()}`;
      if (confirmationResult && typeof confirmationResult.confirm === 'function') {
        const userCred = await confirmationResult.confirm(otp);
        if (userCred && userCred.user) {
          userId = userCred.user.uid;
        }
      }

      // Sync user to Firestore
      try {
        const userRef = doc(db, 'users', userId);
        const snap = await getDoc(userRef);
        if (!snap.exists()) {
          await setDoc(userRef, {
            uid: userId,
            phone_number: phoneNumber || '',
            createdAt: new Date().toISOString()
          });
        }
      } catch (e) {
        console.error('Firestore user sync warning:', e);
      }

      navigation.replace('HomeScreen');
    } catch (err) {
      Alert.alert('Verification Failed', err.message || 'Could not verify OTP code.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Verify Code</Text>
      <Text style={styles.subtitle}>Enter the 6-digit OTP sent to {phoneNumber}</Text>

      <TextInput
        style={styles.input}
        placeholder="Enter OTP"
        value={otp}
        onChangeText={setOtp}
        keyboardType="number-pad"
        maxLength={6}
        editable={!loading}
      />

      <TouchableOpacity 
        style={[styles.button, loading && styles.buttonDisabled]} 
        onPress={handleVerify}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Verify OTP</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 32,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 16,
    fontSize: 24,
    letterSpacing: 8,
    textAlign: 'center',
    marginBottom: 24,
    color: '#1f2937',
    backgroundColor: '#f9fafb',
  },
  button: {
    backgroundColor: '#10b981',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#6ee7b7',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

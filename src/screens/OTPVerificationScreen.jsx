import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, ScrollView, Platform, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { ShieldCheck, ArrowLeft } from 'lucide-react-native';
import { toast } from 'sonner-native';
import { useAppContext } from '../context/AppContext';
import { auth, db, doc, setDoc, getDoc, signInWithPhoneNumber, RecaptchaVerifier } from '../services/firebase';
import { OTPInput } from '../components/OTPInput';

export function OTPVerificationScreen() {
    const { state, setState } = useAppContext();
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [loading, setLoading] = useState(false);
    const [otpError, setOtpError] = useState(false);

    const phone = state.pendingRegistrationPhone || '';
    const confirmationResult = state.confirmationResult;

    const handleBack = () => {
        setState(prev => ({ ...prev, currentView: 'portal' }));
    };

    const handleResendOtp = async () => {
        setLoading(true);
        try {
            if (Platform.OS === 'web' && typeof window !== 'undefined') {
                if (!window.recaptchaVerifier) {
                    window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
                        size: 'invisible'
                    });
                }
                const appVerifier = window.recaptchaVerifier;
                const newConfirm = await signInWithPhoneNumber(auth, phone, appVerifier);
                setState(prev => ({ ...prev, confirmationResult: newConfirm }));
            }
            setOtp(['', '', '', '', '', '']);
            setOtpError(false);
            toast.success('New OTP sent successfully');
        } catch (error) {
            console.error('Resend OTP Error:', error);
            toast.error(error.message || 'Failed to resend OTP.');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async () => {
        const otpValue = otp.join('');
        if (otpValue.length !== 6) {
            setOtpError(true);
            toast.error('Please enter a valid 6-digit OTP');
            return;
        }

        setLoading(true);
        setOtpError(false);

        try {
            let userId = `user_${Date.now()}`;

            // 1. Verify OTP with Firebase Auth confirmation result if available
            if (confirmationResult && typeof confirmationResult.confirm === 'function') {
                const userCredential = await confirmationResult.confirm(otpValue);
                if (userCredential && userCredential.user) {
                    userId = userCredential.user.uid;
                }
            }

            // 2. Save/Update patient in Firestore `users` collection
            try {
                const userDocRef = doc(db, 'users', userId);
                const userSnap = await getDoc(userDocRef);
                if (!userSnap.exists()) {
                    await setDoc(userDocRef, {
                        uid: userId,
                        phone_number: phone,
                        name: 'Patient',
                        createdAt: new Date().toISOString()
                    });
                }
            } catch (fsErr) {
                console.error("Firestore user creation warning:", fsErr);
            }

            // 3. Update app context with patient info
            setState(prev => ({
                ...prev,
                patientInfo: {
                    name: 'Patient',
                    email: '',
                    phone: phone,
                    uid: userId
                },
                currentView: 'patient-dashboard'
            }));

            toast.success('OTP Verified Successfully');

        } catch (error) {
            console.error('Verify OTP Error:', error);
            setOtpError(true);
            toast.error(error.message || 'Invalid OTP. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
            <SafeAreaView style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={styles.content}>
                    <View id="recaptcha-container" />
                    <View style={styles.header}>
                        <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
                            <ArrowLeft size={20} color="#374151" />
                        </TouchableOpacity>
                    </View>

                    <Card style={styles.card}>
                        <CardHeader>
                            <View style={styles.rowCentered}>
                                <ShieldCheck size={24} color="#2563eb" style={{ marginRight: 8 }} />
                                <CardTitle>Verify OTP</CardTitle>
                            </View>
                        </CardHeader>
                        <CardContent>
                            <Text style={styles.otpSubtitle}>Enter the OTP sent to {phone}</Text>

                            <OTPInput 
                                length={6} 
                                value={otp} 
                                onChange={setOtp} 
                                editable={!loading} 
                            />

                            {otpError ? <Text style={[styles.errorText, { textAlign: 'center', marginTop: 8 }]}>Invalid OTP. Please try again.</Text> : null}

                            <Button 
                                onPress={handleVerifyOtp} 
                                disabled={loading || otp.join('').length < 6} 
                                style={{ marginTop: 24, paddingVertical: 14 }}>
                                <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>
                                    {loading ? 'Verifying...' : 'Verify OTP'}
                                </Text>
                            </Button>

                            <View style={styles.resendContainer}>
                                <Text style={styles.resendText}>Didn't receive the code? </Text>
                                <TouchableOpacity onPress={handleResendOtp} disabled={loading}>
                                    <Text style={styles.resendBtn}>Resend OTP</Text>
                                </TouchableOpacity>
                            </View>
                        </CardContent>
                    </Card>
                </ScrollView>
            </SafeAreaView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f9fafb' },
    content: { padding: 16, paddingBottom: 32 },
    header: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
    backBtn: { padding: 8, marginRight: 8 },
    card: { marginBottom: 24 },
    rowCentered: { flexDirection: 'row', alignItems: 'center' },
    otpSubtitle: { fontSize: 16, color: '#4b5563', marginBottom: 24, textAlign: 'center' },
    resendContainer: { flexDirection: 'row', justifyContent: 'center', marginTop: 24, alignItems: 'center' },
    resendText: { color: '#6b7280', fontSize: 14 },
    resendBtn: { color: '#2563eb', fontWeight: '600', fontSize: 14 },
    errorText: { fontSize: 12, color: '#ef4444', marginTop: 4 }
});

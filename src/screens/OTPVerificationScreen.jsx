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
<<<<<<< HEAD
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getOrCreateUserByPhone } from '../services/userService';
=======
import { useTranslation } from '../hooks/useTranslation';
>>>>>>> origin/main

export function OTPVerificationScreen() {
    const { state, setState } = useAppContext();
    const { t } = useTranslation();
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
            toast.success(t('otpResendSuccess'));
        } catch (error) {
            console.error('Resend OTP Error:', error);
            toast.error(error.message || t('otpResendFailed'));
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async () => {
        const otpValue = otp.join('');
        if (otpValue.length !== 6) {
            setOtpError(true);
            toast.error(t('otpInvalidInput'));
            return;
        }

        setLoading(true);
        setOtpError(false);

        try {
            let authUid = null;

            // 1. Verify OTP with Firebase Auth confirmation result if available
            if (confirmationResult && typeof confirmationResult.confirm === 'function') {
                try {
                    const userCredential = await confirmationResult.confirm(otpValue);
                    if (userCredential && userCredential.user) {
                        authUid = userCredential.user.uid;
                    }
                } catch (confirmErr) {
                    console.warn("Firebase confirmationResult error:", confirmErr);
                    // If auth fails in strict mode, throw so user knows OTP was invalid
                    throw confirmErr;
                }
            }

            // 2. Lookup existing user record by phone number or create exactly one if new
            const userRecord = await getOrCreateUserByPhone(phone, authUid);

            const patientInfo = {
                name: userRecord.name || '',
                email: userRecord.email || '',
                phone: userRecord.phone || phone,
                uid: userRecord.uid
            };

            // Save patient info to local storage for persistence
            try {
                await AsyncStorage.setItem('current-patient-info', JSON.stringify(patientInfo));
            } catch (storageErr) {
                console.warn('AsyncStorage error saving patient info:', storageErr);
            }

            // 3. Update app context with patient info
            setState(prev => ({
                ...prev,
                patientInfo: patientInfo,
                currentView: 'patient-dashboard'
            }));

            toast.success(t('otpVerified'));

        } catch (error) {
            console.error('Verify OTP Error:', error);
            setOtpError(true);
            toast.error(error.message || t('otpInvalid'));
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
                                <CardTitle>{t('otpTitle')}</CardTitle>
                            </View>
                        </CardHeader>
                        <CardContent>
                            <Text style={styles.otpSubtitle}>{t('otpSubtitle').replace('{phone}', phone)}</Text>

                            <OTPInput
                                length={6}
                                value={otp}
                                onChange={setOtp}
                                editable={!loading}
                            />

                            {otpError ? <Text style={[styles.errorText, { textAlign: 'center', marginTop: 8 }]}>{t('otpInvalid')}</Text> : null}

                            <Button
                                onPress={handleVerifyOtp}
                                disabled={loading || otp.join('').length < 6}
                                style={{ marginTop: 24, paddingVertical: 14 }}>
                                <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>
                                    {loading ? t('otpVerifying') : t('otpVerifyBtn')}
                                </Text>
                            </Button>

                            <View style={styles.resendContainer}>
                                <Text style={styles.resendText}>{t('otpDidntReceive')} </Text>
                                <TouchableOpacity onPress={handleResendOtp} disabled={loading}>
                                    <Text style={styles.resendBtn}>{t('otpResend')}</Text>
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

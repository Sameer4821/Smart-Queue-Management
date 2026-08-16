import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, KeyboardAvoidingView, ScrollView, Platform, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Phone, ArrowLeft, User } from 'lucide-react-native';
import { toast } from 'sonner-native';
import { useAppContext } from '../context/AppContext';
<<<<<<< HEAD
import { auth, signInWithPhoneNumber, RecaptchaVerifier } from '../services/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getOrCreateUserByPhone } from '../services/userService';
=======
import { supabase } from '../services/supabaseClient';
import { useTranslation } from '../hooks/useTranslation';
>>>>>>> origin/main

export function PatientRegistrationScreen() {
    const { setState } = useAppContext();
    const { t } = useTranslation();
    const [phone, setPhone] = useState('');
    const [loading, setLoading] = useState(false);
    const [phoneError, setPhoneError] = useState('');

    const handleBack = () => {
        setState(prev => ({ ...prev, currentView: 'portal' }));
    };

    const validatePhone = (p) => {
        const phoneRegex = /^[+]?[\d\s\-\(\)]{10,}$/;
        return phoneRegex.test(p.replace(/\s/g, ''));
    };

    const handleSubmit = async () => {
        if (!phone.trim()) {
            setPhoneError(t('regMobileRequired'));
            return;
        } else if (!validatePhone(phone)) {
            setPhoneError(t('regInvalidMobile'));
            return;
        }

        setLoading(true);
        setPhoneError('');

        // Ensure +91 format if no code provided
        const formattedPhone = phone.startsWith('+') ? phone : `+91${phone}`;

        try {
            let confirmationResult = null;
            
            // Web / Expo Web Recaptcha setup
            if (Platform.OS === 'web' && typeof window !== 'undefined') {
                if (!window.recaptchaVerifier) {
                    window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
                        size: 'invisible',
                        callback: () => {}
                    });
                }
                const appVerifier = window.recaptchaVerifier;
                confirmationResult = await signInWithPhoneNumber(auth, formattedPhone, appVerifier);
            } else {
                // Native React Native / fallback
                try {
                    confirmationResult = await signInWithPhoneNumber(auth, formattedPhone);
                } catch (e) {
                    console.log("Native phone auth trigger attempt:", e);
                }
            }

            toast.success(t('regOtpSent'));
            setState(prev => ({
                ...prev,
                pendingRegistrationPhone: formattedPhone,
                confirmationResult: confirmationResult,
                currentView: 'otp-verification'
            }));
        } catch (error) {
<<<<<<< HEAD
            console.error('Firebase OTP Send Error:', error);
            // Fallback for local testing / demo without strict Firebase SMS setup
            toast.info('Moving to OTP verification screen');
            setState(prev => ({
                ...prev,
                pendingRegistrationPhone: formattedPhone,
                currentView: 'otp-verification'
            }));
=======
            console.error('OTP Send Error:', error);
            toast.error(error.message || t('regOtpFailed'));
>>>>>>> origin/main
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
                        <View style={{ flex: 1 }}>
                            <Text style={styles.title}>{t('regTitle')}</Text>
                            <Text style={styles.subtitle}>{t('regSubtitle')}</Text>
                        </View>
                    </View>

                    <Card style={styles.card}>
                        <CardHeader>
                            <View style={styles.rowCentered}>
                                <User size={20} color="#111827" style={{ marginRight: 8 }} />
                                <CardTitle>{t('regPersonalInfo')}</CardTitle>
                            </View>
                        </CardHeader>
                        <CardContent>
                            <View style={styles.inputGroup}>
                                <View style={styles.labelRow}>
                                    <Phone size={16} color="#374151" style={{ marginRight: 4 }} />
                                    <Text style={styles.label}>{t('regMobileNumber')}</Text>
                                </View>
                                <TextInput
                                    style={[styles.input, phoneError && styles.inputError]}
                                    placeholder={t('regEnterMobile')}
                                    value={phone}
                                    onChangeText={(val) => {
                                        setPhone(val);
                                        setPhoneError('');
                                    }}
                                    keyboardType="phone-pad"
                                    editable={!loading}
                                    maxLength={10}
                                />
                                {phoneError ? <Text style={styles.errorText}>{phoneError}</Text> : null}
                            </View>

                            <Button
                                onPress={handleSubmit}
                                disabled={loading || !phone.trim()}
                                style={{ marginTop: 16 }}>
                                <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>
                                    {loading ? t('regSendingOtp') : t('regContinue')}
                                </Text>
                            </Button>

<<<<<<< HEAD
                            <Button 
                                onPress={async () => {
                                    const testPhone = '+919999999999';
                                    const userRecord = await getOrCreateUserByPhone(testPhone, 'user_dev_test');
                                    const patientInfo = {
                                        name: userRecord.name || '',
                                        email: userRecord.email || '',
                                        phone: userRecord.phone || testPhone,
                                        uid: userRecord.uid
                                    };
                                    try {
                                        await AsyncStorage.setItem('current-patient-info', JSON.stringify(patientInfo));
                                    } catch (e) {}
=======
                            <Button
                                onPress={() => {
>>>>>>> origin/main
                                    setState(prev => ({
                                        ...prev,
                                        patientInfo: patientInfo,
                                        currentView: 'patient-dashboard'
                                    }));
                                }}
                                style={{ marginTop: 16, backgroundColor: '#10b981' }}>
                                <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>
                                    {t('regSkipLogin')}
                                </Text>
                            </Button>
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
    title: { fontSize: 24, fontWeight: 'bold', color: '#111827' },
    subtitle: { fontSize: 14, color: '#6b7280' },
    card: { marginBottom: 24 },
    rowCentered: { flexDirection: 'row', alignItems: 'center' },
    inputGroup: { marginBottom: 16 },
    labelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    label: { fontSize: 14, fontWeight: '500', color: '#374151' },
    input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12, fontSize: 16, backgroundColor: '#fff' },
    inputError: { borderColor: '#ef4444' },
    errorText: { fontSize: 12, color: '#ef4444', marginTop: 4 },
});

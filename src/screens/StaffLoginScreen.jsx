import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, KeyboardAvoidingView, ScrollView, Platform, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { ArrowLeft, Key, UserCheck } from 'lucide-react-native';
import { toast } from 'sonner-native';
import { useAppContext } from '../context/AppContext';
<<<<<<< HEAD
import { db, doc, getDoc, setDoc, collection, query, where, getDocs } from '../services/firebase';
=======
import { supabase } from '../services/supabaseClient';
import { useTranslation } from '../hooks/useTranslation';
>>>>>>> origin/main

export function StaffLoginScreen() {
    const { setState } = useAppContext();
    const { t } = useTranslation();
    const [staffId, setStaffId] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleBack = () => {
        setState(prev => ({ ...prev, currentView: 'portal' }));
    };

    const handleLogin = async () => {
        if (!staffId.trim() || !password.trim()) {
            setError(t('staffBothRequired'));
            return;
        }

        setLoading(true);
        setError('');

        try {
<<<<<<< HEAD
            // Check Firestore staff_accounts collection
            const staffRef = doc(db, 'staff_accounts', staffId.trim());
            let staffSnap = await getDoc(staffRef);

            let staffData = null;

            if (staffSnap.exists()) {
                staffData = staffSnap.data();
            } else {
                // Check query by staff_id field
                const q = query(collection(db, 'staff_accounts'), where('staff_id', '==', staffId.trim()));
                const querySnap = await getDocs(q);
                if (!querySnap.empty) {
                    staffData = querySnap.docs[0].data();
                }
            }

            // If staff account doesn't exist yet, seed a default entry for demo/testing
            if (!staffData) {
                staffData = {
                    staff_id: staffId.trim(),
                    name: `Staff Member (${staffId.trim()})`,
                    password_hash: password.trim(),
                    role: 'staff',
                    department: 'General',
                    createdAt: new Date().toISOString()
                };
                try {
                    await setDoc(doc(db, 'staff_accounts', staffId.trim()), staffData);
                } catch (e) {
                    console.log("Error seeding staff doc:", e);
                }
            } else if (staffData.password_hash && staffData.password_hash !== password.trim()) {
                throw new Error("Invalid Staff ID or Password");
=======
            // Note: Secure authentication should ideally go through a Supabase serverless function or proper Supabase identity 
            // Here we emulate a simple table query just to fulfill the staff requirement logic per instructions

            const { data: staffData, error: staffError } = await supabase
                .from('staff_accounts')
                .select('*')
                .eq('staff_id', staffId)
                .single();

            if (staffError) {
                throw new Error(t('staffLoginFailed'));
            }

            // In production: DO NOT compare plaintext passwords. A secure server or Supabase Auth should handle passwords.
            // Using placeholder raw comparison based on instructions for simple validation logic:
            if (staffData.password_hash !== password) {
                throw new Error(t('staffLoginFailed'));
>>>>>>> origin/main
            }

            toast.success(t('staffLoginSuccess'));

            // Allow access to staff dashboard
            setState(prev => ({
                ...prev,
                staffInfo: staffData,
                currentView: 'staff-dashboard'
            }));

        } catch (error) {
            console.error('Staff Login Error:', error);
            setError(error.message || t('staffLoginFailed'));
            toast.error(error.message || t('staffLoginFailed'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
            <SafeAreaView style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={styles.content}>
                    <View style={styles.header}>
                        <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
                            <ArrowLeft size={20} color="#374151" />
                        </TouchableOpacity>
                    </View>

                    <Card style={styles.card}>
                        <CardHeader>
                            <View style={styles.rowCentered}>
                                <UserCheck size={24} color="#0f172a" style={{ marginRight: 8 }} />
                                <CardTitle>{t('staffPortalLogin')}</CardTitle>
                            </View>
                        </CardHeader>
                        <CardContent>
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>{t('staffId')}</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder={t('staffEnterStaffId')}
                                    value={staffId}
                                    onChangeText={(val) => {
                                        setStaffId(val);
                                        setError('');
                                    }}
                                    autoCapitalize="none"
                                    editable={!loading}
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>{t('staffPassword')}</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder={t('staffEnterPassword')}
                                    value={password}
                                    onChangeText={(val) => {
                                        setPassword(val);
                                        setError('');
                                    }}
                                    secureTextEntry
                                    editable={!loading}
                                />
                            </View>

                            {error ? <Text style={styles.errorText}>{error}</Text> : null}

                            <Button
                                onPress={handleLogin}
                                disabled={loading || !staffId.trim() || !password.trim()}
                                style={{ marginTop: 24, paddingVertical: 14 }}>
                                <View style={styles.btnContent}>
                                    <Key size={18} color="#fff" style={{ marginRight: 8 }} />
                                    <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>
                                        {loading ? t('staffAuthenticating') : t('staffSecureLogin')}
                                    </Text>
                                </View>
                            </Button>

                            <Button
                                onPress={() => {
                                    setState(prev => ({
                                        ...prev,
                                        staffInfo: { name: "Guest Staff", department: "General" },
                                        currentView: 'staff-dashboard'
                                    }));
                                }}
                                style={{ marginTop: 12, paddingVertical: 14, backgroundColor: '#94a3b8' }}>
                                <View style={styles.btnContent}>
                                    <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>
                                        {t('staffBypassLogin')}
                                    </Text>
                                </View>
                            </Button>
                        </CardContent>
                    </Card>
                </ScrollView>
            </SafeAreaView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f1f5f9' },
    content: { padding: 16, paddingBottom: 32 },
    header: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
    backBtn: { padding: 8, marginRight: 8 },
    card: { marginBottom: 24, borderRadius: 12 },
    rowCentered: { flexDirection: 'row', alignItems: 'center' },
    inputGroup: { marginBottom: 16 },
    label: { fontSize: 14, fontWeight: '600', color: '#334155', marginBottom: 8 },
    input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, backgroundColor: '#fff', color: '#1e293b' },
    errorText: { fontSize: 14, color: '#ef4444', marginTop: 8, textAlign: 'center', fontWeight: '500' },
    btnContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }
});

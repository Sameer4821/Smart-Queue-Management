import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, KeyboardAvoidingView, ScrollView, Platform, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { User, Calendar, MapPin, Mail, Phone, Activity, ArrowLeft } from 'lucide-react-native';
import { toast } from 'sonner-native';
import { useAppContext } from '../context/AppContext';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from '../hooks/useTranslation';

export function PatientPersonalInfoSetup() {
    const { state, setState } = useAppContext();
    const { user } = useAuth();
    const { t } = useTranslation();

    const [form, setForm] = useState({
        full_name: '',
        dob: '',
        gender: '',
        phone_number: state.patientInfo?.phone || '',
        email: '',
        address: '',
        emergency_contact: ''
    });

    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});

    const handleSave = async () => {
        const newErrors = {};
        if (!form.full_name.trim()) newErrors.full_name = 'Full name is required';
        if (!form.dob.trim()) newErrors.dob = 'Date of birth is required';
        if (!form.phone_number.trim()) newErrors.phone_number = 'Phone number is required';

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            toast.error('Please fill required fields');
            return;
        }

        setLoading(true);
        try {
            if (user) {
                const { error } = await supabase
                    .from('patients')
                    .update({
                        full_name: form.full_name.trim(),
                        dob: form.dob.trim(),
                        gender: form.gender.trim(),
                        phone_number: form.phone_number.trim(),
                        email: form.email.trim(),
                        address: form.address.trim(),
                        emergency_contact: form.emergency_contact.trim()
                    })
                    .eq('id', user.id);

                if (error) throw error;
            }

            toast.success('Profile saved successfully!');
            setState(prev => ({
                ...prev,
                patientInfo: {
                    ...prev.patientInfo,
                    name: form.full_name.trim(),
                    email: form.email.trim(),
                    phone: form.phone_number.trim()
                },
                currentView: 'patient-dashboard'
            }));
        } catch (error) {
            console.error('Save Profile Error:', error);
            toast.error(error.message || 'Failed to save profile');
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
            <SafeAreaView style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={styles.content}>
                    <View style={styles.header}>
                        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                            <TouchableOpacity onPress={() => setState(prev => ({ ...prev, currentView: 'patient-registration', patientInfo: null }))} style={{ padding: 8, marginRight: 8 }}>
                                <ArrowLeft size={20} color="#374151" />
                            </TouchableOpacity>
                            <View>
                                <Text style={styles.title}>Personal Information</Text>
                                <Text style={styles.subtitle}>Please complete your profile to continue</Text>
                            </View>
                        </View>
                    </View>

                    <Card style={styles.card}>
                        <CardHeader>
                            <View style={styles.rowCentered}>
                                <User size={20} color="#111827" style={{ marginRight: 8 }} />
                                <CardTitle>Profile Details</CardTitle>
                            </View>
                        </CardHeader>
                        <CardContent>
                            <View style={styles.inputGroup}>
                                <View style={styles.labelRow}>
                                    <User size={16} color="#374151" style={{ marginRight: 4 }} />
                                    <Text style={styles.label}>Full Name *</Text>
                                </View>
                                <TextInput
                                    style={[styles.input, errors.full_name && styles.inputError]}
                                    placeholder="Enter your full name"
                                    value={form.full_name}
                                    onChangeText={(val) => { setForm({ ...form, full_name: val }); setErrors({ ...errors, full_name: null }); }}
                                    editable={!loading}
                                />
                                {errors.full_name ? <Text style={styles.errorText}>{errors.full_name}</Text> : null}
                            </View>

                            <View style={styles.inputGroup}>
                                <View style={styles.labelRow}>
                                    <Phone size={16} color="#374151" style={{ marginRight: 4 }} />
                                    <Text style={styles.label}>Phone Number *</Text>
                                </View>
                                <TextInput
                                    style={[styles.input, errors.phone_number && styles.inputError]}
                                    placeholder="Enter your phone number"
                                    value={form.phone_number}
                                    onChangeText={(val) => { setForm({ ...form, phone_number: val }); setErrors({ ...errors, phone_number: null }); }}
                                    keyboardType="phone-pad"
                                    editable={!loading}
                                />
                                {errors.phone_number ? <Text style={styles.errorText}>{errors.phone_number}</Text> : null}
                            </View>

                            <View style={styles.inputGroup}>
                                <View style={styles.labelRow}>
                                    <Calendar size={16} color="#374151" style={{ marginRight: 4 }} />
                                    <Text style={styles.label}>Date of Birth or Age *</Text>
                                </View>
                                <TextInput
                                    style={[styles.input, errors.dob && styles.inputError]}
                                    placeholder="e.g. 01/01/1990 or 30"
                                    value={form.dob}
                                    onChangeText={(val) => { setForm({ ...form, dob: val }); setErrors({ ...errors, dob: null }); }}
                                    editable={!loading}
                                />
                                {errors.dob ? <Text style={styles.errorText}>{errors.dob}</Text> : null}
                            </View>

                            <View style={styles.inputGroup}>
                                <View style={styles.labelRow}>
                                    <User size={16} color="#374151" style={{ marginRight: 4 }} />
                                    <Text style={styles.label}>Gender</Text>
                                </View>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Male / Female / Other"
                                    value={form.gender}
                                    onChangeText={(val) => setForm({ ...form, gender: val })}
                                    editable={!loading}
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <View style={styles.labelRow}>
                                    <Mail size={16} color="#374151" style={{ marginRight: 4 }} />
                                    <Text style={styles.label}>Email Address</Text>
                                </View>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Enter email (optional)"
                                    value={form.email}
                                    onChangeText={(val) => setForm({ ...form, email: val })}
                                    keyboardType="email-address"
                                    editable={!loading}
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <View style={styles.labelRow}>
                                    <MapPin size={16} color="#374151" style={{ marginRight: 4 }} />
                                    <Text style={styles.label}>Address</Text>
                                </View>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Enter address (optional)"
                                    value={form.address}
                                    onChangeText={(val) => setForm({ ...form, address: val })}
                                    editable={!loading}
                                    multiline
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <View style={styles.labelRow}>
                                    <Activity size={16} color="#ef4444" style={{ marginRight: 4 }} />
                                    <Text style={styles.label}>Emergency Contact</Text>
                                </View>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Emergency phone number (optional)"
                                    value={form.emergency_contact}
                                    onChangeText={(val) => setForm({ ...form, emergency_contact: val })}
                                    keyboardType="phone-pad"
                                    editable={!loading}
                                />
                            </View>

                            <Button
                                onPress={handleSave}
                                disabled={loading}
                                style={{ marginTop: 16 }}>
                                <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>
                                    {loading ? 'Saving...' : 'Save & Continue'}
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
    title: { fontSize: 24, fontWeight: 'bold', color: '#111827' },
    subtitle: { fontSize: 14, color: '#6b7280', marginTop: 4 },
    card: { marginBottom: 24 },
    rowCentered: { flexDirection: 'row', alignItems: 'center' },
    inputGroup: { marginBottom: 16 },
    labelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    label: { fontSize: 14, fontWeight: '500', color: '#374151' },
    input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12, fontSize: 16, backgroundColor: '#fff' },
    inputError: { borderColor: '#ef4444' },
    errorText: { fontSize: 12, color: '#ef4444', marginTop: 4 },
});

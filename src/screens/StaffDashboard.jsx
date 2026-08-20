import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAppContext } from "../context/AppContext";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useTranslation } from "../hooks/useTranslation";

import {
  HeartPulse,
  Activity,
  Stethoscope,
  AlertCircle,
  AlertTriangle,
  Bell,
  Clock,
  Phone,
  Truck,
  FilePlus2,
  FileText,
  CheckCircle2,
  ArrowLeft,
  Settings,
  Globe,
  Camera,
  Upload,
  QrCode,
  Save,
  Plus
} from "lucide-react-native";
import { Card } from "../components/ui/card";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../components/ui/select";
import { toast } from "sonner-native";
import { supabase } from "../services/supabaseClient";

// Template data
const TEMPLATES = [
  { name: "Fever", diagnosis: "Viral Fever", medicines: [{ name: "Paracetamol 500mg", dosage: "1-1-1", days: "3" }] },
  { name: "Cold", diagnosis: "Common Cold", medicines: [{ name: "Cetirizine 10mg", dosage: "0-0-1", days: "5" }] },
  { name: "Cough", diagnosis: "Dry Cough", medicines: [{ name: "Cough Syrup", dosage: "1-1-1", days: "5" }] },
  { name: "Headache", diagnosis: "Tension Headache", medicines: [{ name: "Ibuprofen 400mg", dosage: "1-0-1", days: "2" }] },
  { name: "Migraine", diagnosis: "Migraine", medicines: [{ name: "Naproxen 500mg", dosage: "1-0-1", days: "3" }] },
  { name: "Gastric", diagnosis: "Acidity", medicines: [{ name: "Pantoprazole 40mg", dosage: "1-0-0", days: "5" }] },
  { name: "Body Pain", diagnosis: "Myalgia", medicines: [{ name: "Aceclofenac", dosage: "1-0-1", days: "3" }] },
  { name: "High BP", diagnosis: "Hypertension", medicines: [{ name: "Amlodipine 5mg", dosage: "1-0-0", days: "30" }] },
  { name: "Diabetes", diagnosis: "Type 2 DM", medicines: [{ name: "Metformin 500mg", dosage: "1-0-1", days: "30" }] },
];

const QUICK_DOSAGE = ["1-0-1", "1-1-1", "0-0-1", "SOS"];

export function StaffDashboard() {
  const { state: appState, setState: setAppState, addPrescriptionToToken } = useAppContext();

  // ─── EMERGENCY ALERTS ───
  const severityOrder = { critical: 0, urgent: 1, moderate: 2 };
  const emergencyAlerts = (appState.emergencyAlerts || [])
    .filter(a => a.alert_status !== 'resolved')
    .sort((a, b) => {
      const sA = severityOrder[a.severity] !== undefined ? severityOrder[a.severity] : 3;
      const sB = severityOrder[b.severity] !== undefined ? severityOrder[b.severity] : 3;
      if (sA !== sB) return sA - sB;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
  const { t } = useTranslation();


  // Camera permissions
  const [permission, requestPermission] = useCameraPermissions();

  // Sort queue strictly by priority
  const priorityMap = { emergency: 1, disabled: 2, common: 3 };

  // All active tokens, filtered by staff department (plus global emergencies)
  const allActiveTokens = (appState.tokens || []).filter(t =>
    (t.status === "active" || t.status === "waiting") &&
    (t.primaryDepartment === (appState.staffInfo?.department || "General Medicine") ||
      t.type?.toLowerCase() === 'emergency' ||
      t.primaryDepartment?.toLowerCase() === 'emergency')
  ).sort((a, b) => {
    const isAEmergency = a.type?.toLowerCase() === 'emergency' || a.primaryDepartment?.toLowerCase() === 'emergency';
    const isBEmergency = b.type?.toLowerCase() === 'emergency' || b.primaryDepartment?.toLowerCase() === 'emergency';

    // Ultimate first priority for Emergency
    if (isAEmergency && !isBEmergency) return -1;
    if (!isAEmergency && isBEmergency) return 1;

    // Below them, sort by standard priority map or generation time
    const pA = priorityMap[a.type] || 3;
    const pB = priorityMap[b.type] || 3;
    if (pA !== pB) return pA - pB;

    return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
  });

  const [activePatient, setActivePatient] = useState(allActiveTokens.length > 0 ? allActiveTokens[0] : null);

  // Upcoming queue is all other patients (Fully viewable instead of just 3)
  const upcomingQueue = allActiveTokens.filter(t => t.id !== activePatient?.id);
  const totalWaiting = allActiveTokens.length;

  // Track prescription mode
  const [prescriptionMode, setPrescriptionMode] = useState(null); // 'template', 'upload', 'scan'

  // Template Form State
  const [diagnosis, setDiagnosis] = useState("");
  const [medicines, setMedicines] = useState([]);
  const [advice, setAdvice] = useState("");

  // QR Scanner State
  const [scannerOpen, setScannerOpen] = useState(false);
  const [lastScannedPatient, setLastScannedPatient] = useState(null);
  const [nextPatientAfterScan, setNextPatientAfterScan] = useState(null);
  const scanLockRef = useRef(false);

  // Auto-update active patient if no patient is selected
  useEffect(() => {
    if (!activePatient && allActiveTokens.length > 0) {
      setActivePatient(allActiveTokens[0]);
    }
  }, [allActiveTokens]);

  // Supabase Real-Time Sync for Token Queue
  useEffect(() => {
    const fetchInitialQueue = async () => {
      try {
        const { data, error } = await supabase
          .from('queue')
          .select('*')
          .in('status', ['waiting', 'active']);

        if (error) {
          console.error("Error fetching initial queue:", error);
          return;
        }

        const initialTokens = data.map(row => ({
          id: row.token_id,
          type: row.token_id && row.token_id.startsWith('EME') ? 'emergency' : row.token_id && row.token_id.startsWith('ACE') ? 'disabled' : 'common',
          primaryDepartment: row.department,
          timestamp: row.created_at ? new Date(row.created_at) : new Date(),
          patient: {
            name: row.patient_name || 'Walk-in Patient',
          },
          status: row.status || 'active',
          qrCode: row.token_id
        }));

        setAppState(prev => {
          const existingIds = new Set(prev.tokens.map(t => t.id));
          const newTokens = initialTokens.filter(t => !existingIds.has(t.id));
          if (newTokens.length === 0) return prev;
          return { ...prev, tokens: [...prev.tokens, ...newTokens] };
        });
      } catch (err) {
        console.error("Failed to fetch initial queue:", err);
      }
    };

    fetchInitialQueue();

    const channel = supabase.channel('public:queue_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queue' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const newRow = payload.new;
          const mappedToken = {
            id: newRow.token_id,
            type: newRow.token_id && newRow.token_id.startsWith('EME') ? 'emergency' : newRow.token_id && newRow.token_id.startsWith('ACE') ? 'disabled' : 'common',
            primaryDepartment: newRow.department,
            timestamp: newRow.created_at ? new Date(newRow.created_at) : new Date(),
            patient: {
              name: newRow.patient_name || 'Walk-in Patient',
            },
            status: newRow.status || 'active',
            qrCode: newRow.token_id
          };

          setAppState(prev => {
            const exists = prev.tokens.find(t => t.id === mappedToken.id);
            if (exists) return prev;
            return { ...prev, tokens: [...prev.tokens, mappedToken] };
          });
        }
        else if (payload.eventType === 'UPDATE') {
          setAppState(prev => ({
            ...prev,
            tokens: prev.tokens.map(t => t.id === payload.new.token_id ? { ...t, status: payload.new.status } : t)
          }));
        }
        else if (payload.eventType === 'DELETE') {
          setAppState(prev => ({
            ...prev,
            tokens: prev.tokens.filter(t => t.id !== payload.old.token_id)
          }));
        }
      })
      .subscribe();

    // Also subscribe to emergency_alerts for realtime updates
    const emergencyChannel = supabase.channel('staff:emergency_alerts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'emergency_alerts' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setAppState(prev => {
            const existing = prev.emergencyAlerts || [];
            const exists = existing.find(a => a.alert_id === payload.new.alert_id);
            if (exists) return prev;
            toast.error(`🚨 New Emergency Alert`, {
              description: `${payload.new.severity.toUpperCase()}: ${payload.new.emergency_type} - ${payload.new.patient_name}`,
              duration: 10000,
            });
            return { ...prev, emergencyAlerts: [...existing, payload.new] };
          });
        } else if (payload.eventType === 'UPDATE') {
          setAppState(prev => ({
            ...prev,
            emergencyAlerts: (prev.emergencyAlerts || []).map(a =>
              a.alert_id === payload.new.alert_id ? { ...a, ...payload.new } : a
            )
          }));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(emergencyChannel);
    };
  }, []);

  const handleBack = () => {
    setAppState((prev) => ({ ...prev, currentView: "portal" }));
  };

  // ─── EMERGENCY ALERT ACTIONS ───
  const handleAcknowledgeAlert = async (alertId) => {
    try {
      const staffName = appState.staffInfo?.name || 'Staff';
      await supabase
        .from('emergency_alerts')
        .update({ alert_status: 'acknowledged', acknowledged_by: staffName, acknowledged_at: new Date().toISOString() })
        .eq('alert_id', alertId);

      setAppState(prev => ({
        ...prev,
        emergencyAlerts: (prev.emergencyAlerts || []).map(a =>
          a.alert_id === alertId ? { ...a, alert_status: 'acknowledged', acknowledged_by: staffName, acknowledged_at: new Date().toISOString() } : a
        )
      }));
      toast.success('Alert Acknowledged');
    } catch (err) {
      toast.error('Failed to acknowledge alert');
    }
  };

  const handleUpdateAlertStatus = async (alertId, newStatus) => {
    try {
      await supabase
        .from('emergency_alerts')
        .update({ alert_status: newStatus })
        .eq('alert_id', alertId);

      setAppState(prev => ({
        ...prev,
        emergencyAlerts: (prev.emergencyAlerts || []).map(a =>
          a.alert_id === alertId ? { ...a, alert_status: newStatus } : a
        )
      }));
      toast.success(`Alert marked as ${newStatus.replace('_', ' ')}`);
    } catch (err) {
      toast.error('Failed to update alert status');
    }
  };

  const getSeverityStyle = (severity) => {
    if (severity === 'critical') return { bg: '#fef2f2', border: '#fca5a5', text: '#dc2626', label: (t('emgCritical') || 'critical').split(' ')[0].toUpperCase() };
    if (severity === 'urgent') return { bg: '#fff7ed', border: '#fdba74', text: '#ea580c', label: (t('emgUrgent') || 'urgent').split(' ')[0].toUpperCase() };
    return { bg: '#fefce8', border: '#fde047', text: '#ca8a04', label: (t('emgModerate') || 'moderate').split(' ')[0].toUpperCase() };
  };

  const getAlertStatusStyle = (status) => {
    if (status === 'new') return { bg: '#dc2626', label: 'NEW' };
    if (status === 'acknowledged') return { bg: '#2563eb', label: (t('staffAck') || 'ACKNOWLEDGED').toUpperCase() };
    if (status === 'in_progress') return { bg: '#ea580c', label: (t('staffInProgress') || 'IN PROGRESS').toUpperCase() };
    return { bg: '#16a34a', label: (t('staffResolve') || 'RESOLVED').toUpperCase() };
  };


  const formatAlertTime = (dateStr) => {
    if (!dateStr) return '--';
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getArrivalLabel = (method) => {
    if (method === 'ambulance') return '🚑 ' + t('emgAmbulance');
    if (method === 'own_transport') return '🚗 ' + t('emgOwnTransport');
    if (method === 'already_here') return '🏥 ' + t('emgAlreadyHere');
    return '--';
  };


  const handleLanguageChange = (language) => {
    setAppState((prev) => ({
      ...prev,
      language: language,
    }));
  };

  const handleApplyTemplate = (template) => {
    setDiagnosis(template.diagnosis);
    setMedicines([...template.medicines]);
    toast.success(`Applied ${template.name} Template`);
  };

  const addMedicineRow = () => {
    setMedicines([...medicines, { name: "", dosage: "", days: "" }]);
  };

  const updateMedicine = (index, field, value) => {
    const updated = [...medicines];
    updated[index][field] = value;
    setMedicines(updated);
  };

  const handleSavePrescription = async () => {
    if (!activePatient) return;

    const prescription = {
      id: `RX-${Date.now()}`,
      prescribedAt: new Date(),
      medicines: medicines,
      diagnosis: diagnosis,
      advice: advice,
      mode: prescriptionMode
    };

    addPrescriptionToToken(activePatient.id, prescription);

    // Save to Supabase to trigger realtime sync
    try {
      const { error } = await supabase.from('prescriptions').insert({
        token_id: activePatient.id,
        patient_id: activePatient.patient?.phone || activePatient.patient?.email || "unknown",
        doctor_id: appState.staffInfo?.id || 'staff',
        department: activePatient.primaryDepartment,
        diagnosis,
        medicines,
        advice,
        mode: prescriptionMode
      });
      if (error) {
        console.error("Supabase insert error:", error);
        toast.error("Sync partial", { description: "Saved locally but failed to push to server." });
      }
    } catch (err) {
      console.error("Error saving prescription to Supabase:", err);
    }

    toast.success("Prescription Saved", {
      description: "Available in patient records.",
    });

    // Reset panel
    setPrescriptionMode(null);
    setDiagnosis("");
    setMedicines([]);
    setAdvice("");
  };

  const handleMarkComplete = async () => {
    if (!activePatient) return;

    try {
      // Update Supabase queue table
      await supabase
        .from('queue')
        .update({ status: 'completed' })
        .eq('token_id', activePatient.id);

      // Optimistic update
      const updatedTokens = appState.tokens.map((token) =>
        token.id === activePatient.id ? { ...token, status: "completed" } : token
      );

      setAppState((prev) => ({ ...prev, tokens: updatedTokens }));
      toast.success("Consultation Completed", {
        description: `${activePatient.patient?.name || "Patient"}'s session is closed.`,
      });

      setPrescriptionMode(null);

      // Find next patient
      const remainingTokens = allActiveTokens.filter(t => t.id !== activePatient.id);
      setActivePatient(remainingTokens.length > 0 ? remainingTokens[0] : null);
    } catch (error) {
      toast.error("Error", { description: "Failed to mark patient as completed." });
    }
  };

  const openScanner = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        toast.error("Camera Permission Denied", {
          description: "Please grant camera access to scan QR codes.",
        });
        return;
      }
    }
    scanLockRef.current = false;
    setLastScannedPatient(null);
    setNextPatientAfterScan(null);
    setScannerOpen(true);
  };

  const closeScanner = () => {
    setScannerOpen(false);
    scanLockRef.current = false;
  };

  const handleBarCodeScanned = async ({ data }) => {
    // Prevent multiple rapid scans
    if (scanLockRef.current) return;
    scanLockRef.current = true;

    const scannedId = data.trim();

    // Find matching active token
    const matchedToken = allActiveTokens.find(
      (tok) => tok.id === scannedId || tok.qrCode === scannedId
    );

    if (!matchedToken) {
      toast.error("No Match Found", {
        description: "This QR code doesn't match any active appointment.",
      });
      // Allow re-scanning after a short delay
      setTimeout(() => { scanLockRef.current = false; }, 2000);
      return;
    }

    try {
      // Update Supabase queue table
      await supabase
        .from('queue')
        .update({ status: 'completed' })
        .eq('token_id', matchedToken.id);

      // Optimistic upate
      const updatedTokens = appState.tokens.map((token) =>
        token.id === matchedToken.id ? { ...token, status: "completed" } : token
      );
      setAppState((prev) => ({ ...prev, tokens: updatedTokens }));

      // Set the scanned patient for display
      setLastScannedPatient(matchedToken);

      // Find next patient in queue
      const remainingTokens = allActiveTokens.filter((tok) => tok.id !== matchedToken.id);
      const nextInLine = remainingTokens.length > 0 ? remainingTokens[0] : null;
      setNextPatientAfterScan(nextInLine);
      setActivePatient(nextInLine);

      setPrescriptionMode(null);
      setScannerOpen(false);

      toast.success("✅ Appointment Completed", {
        description: `${matchedToken.patient?.name || "Patient"}'s appointment has been marked complete.`,
      });
    } catch (error) {
      toast.error("Error", { description: "Failed to mark scanned patient as completed." });
      scanLockRef.current = false;
    }
  };

  const formatTokenId = (id) => {
    if (!id) return "---";
    const parts = id.split("-");
    let base = parts.length > 2 ? parts[2] : id;
    if (base.length > 4) base = base.substring(0, 4);
    return base;
  };

  const getPriorityColors = (type) => {
    if (type === "emergency") return { bg: "#fef2f2", text: "#ef4444", border: "#fca5a5", name: "Emergency" };
    if (type === "disabled") return { bg: "#f0fdfa", text: "#0d9488", border: "#99f6e4", name: "Accessibility" };
    return { bg: "#f0f9ff", text: "#0ea5e9", border: "#bae6fd", name: "General" };
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 1. HEADER */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
            <ArrowLeft size={24} color="#1e293b" />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.dashboardTitle}>{t('staffDashboardTitle') || "Staff Dashboard"}</Text>
            <Text style={styles.doctorName}>
              {appState.staffInfo?.name || "Dr. Assigned"} • {appState.staffInfo?.department || "General"}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0' }}>
              <Globe size={20} color="#1e293b" style={{ marginRight: 8 }} />
              <Select value={appState.language} onValueChange={handleLanguageChange}>
                <SelectTrigger style={{ width: 110, borderWidth: 0, paddingHorizontal: 0 }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="hi">हिंदी</SelectItem>
                  <SelectItem value="mr">मराठी</SelectItem>
                  <SelectItem value="te">తెలుగు</SelectItem>
                  <SelectItem value="ta">தமிழ்</SelectItem>
                  <SelectItem value="bn">বাংলা</SelectItem>
                </SelectContent>
              </Select>
            </View>
          </View>
        </View>
        <View style={styles.statsBar}>
          <Text style={styles.waitCountText}>
            {t('staffWaiting')}: <Text style={{ fontWeight: "700" }}>{totalWaiting}</Text>
          </Text>
        </View>
      </View>


      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* EMERGENCY ALERTS SECTION */}
        {emergencyAlerts.length > 0 && (
          <View style={eaStyles.section}>
            <View style={eaStyles.sectionHeader}>
              <AlertTriangle size={20} color="#dc2626" />
              <Text style={eaStyles.sectionTitle}>{t('staffEmergencyAlerts')} ({emergencyAlerts.length})</Text>
            </View>

            {emergencyAlerts.map((alert) => {
              const sevStyle = getSeverityStyle(alert.severity);
              const statusStyle = getAlertStatusStyle(alert.alert_status);
              return (
                <View key={alert.alert_id} style={[eaStyles.alertCard, { borderColor: sevStyle.border, backgroundColor: sevStyle.bg }]}>
                  {/* Header row: severity + status */}
                  <View style={eaStyles.alertHeader}>
                    <View style={[eaStyles.severityBadge, { backgroundColor: sevStyle.text }]}>
                      <Text style={eaStyles.severityBadgeText}>{sevStyle.label}</Text>
                    </View>
                    <View style={[eaStyles.statusBadge, { backgroundColor: statusStyle.bg }]}>
                      <Text style={eaStyles.statusBadgeText}>{statusStyle.label}</Text>
                    </View>
                  </View>

                  {/* Emergency + Patient info */}
                  <Text style={[eaStyles.alertType, { color: sevStyle.text }]}>{alert.emergency_type}</Text>
                  <Text style={eaStyles.patientName}>{alert.patient_name}{alert.patient_age ? `, ${alert.patient_age} yrs` : ''}{alert.patient_gender ? ` • ${alert.patient_gender.charAt(0).toUpperCase()}` : ''}</Text>

                  {/* Condition */}
                  {alert.condition_details ? (
                    <Text style={eaStyles.conditionText} numberOfLines={3}>{alert.condition_details}</Text>
                  ) : null}

                  {/* Details row */}
                  <View style={eaStyles.detailsRow}>
                    {alert.arrival_method ? (
                      <View style={eaStyles.detailChip}>
                        <Truck size={12} color="#475569" />
                        <Text style={eaStyles.detailChipText}>{getArrivalLabel(alert.arrival_method)}</Text>
                      </View>
                    ) : null}
                    {alert.estimated_arrival ? (
                      <View style={eaStyles.detailChip}>
                        <Clock size={12} color="#475569" />
                        <Text style={eaStyles.detailChipText}>{t('staffEta') || "ETA"}: {alert.estimated_arrival}</Text>
                      </View>
                    ) : null}
                    {alert.contact_number ? (
                      <View style={eaStyles.detailChip}>
                        <Phone size={12} color="#475569" />
                        <Text style={eaStyles.detailChipText}>{alert.contact_number}</Text>
                      </View>
                    ) : null}
                  </View>

                  {/* Assistance needed */}
                  {alert.assistance_needed && alert.assistance_needed.length > 0 ? (
                    <View style={eaStyles.assistanceRow}>
                      <Text style={eaStyles.assistanceLabel}>{t('staffAssistance') || "Assistance"}:</Text>
                      <Text style={eaStyles.assistanceText}>{alert.assistance_needed.join(', ')}</Text>
                    </View>
                  ) : null}

                  {/* Time + acknowledged by */}
                  <View style={eaStyles.timeRow}>
                    <Text style={eaStyles.timeText}>{t('staffReceived') || "Received"}: {formatAlertTime(alert.created_at)}</Text>
                    {alert.acknowledged_by ? (
                      <Text style={eaStyles.ackText}>{t('staffAck') || "Ack"}: {alert.acknowledged_by}</Text>
                    ) : null}
                  </View>

                  {/* Action buttons */}
                  <View style={eaStyles.actionsRow}>
                    {alert.alert_status === 'new' && (
                      <TouchableOpacity style={eaStyles.ackBtn} onPress={() => handleAcknowledgeAlert(alert.alert_id)}>
                        <Bell size={14} color="#fff" />
                        <Text style={eaStyles.ackBtnText}>{t('staffAcknowledge') || "Acknowledge"}</Text>
                      </TouchableOpacity>
                    )}
                    {(alert.alert_status === 'new' || alert.alert_status === 'acknowledged') && (
                      <TouchableOpacity style={eaStyles.inProgressBtn} onPress={() => handleUpdateAlertStatus(alert.alert_id, 'in_progress')}>
                        <Activity size={14} color="#fff" />
                        <Text style={eaStyles.ackBtnText}>{t('staffInProgress') || "In Progress"}</Text>
                      </TouchableOpacity>
                    )}
                    {alert.alert_status !== 'resolved' && (
                      <TouchableOpacity style={eaStyles.resolveBtn} onPress={() => handleUpdateAlertStatus(alert.alert_id, 'resolved')}>
                        <CheckCircle2 size={14} color="#fff" />
                        <Text style={eaStyles.ackBtnText}>{t('staffResolve') || "Resolve"}</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                </View>
              );
            })}
          </View>
        )}

        {/* 2. ACTIVE PATIENT CARD */}
        {activePatient ? (
          <View style={styles.activePatientContainer}>
            <Text style={styles.sectionTitle}>{t('staffCurrentPatient') || "Current Patient"}</Text>
            <Card style={styles.activeCard}>
              <View style={styles.activeCardContent}>
                <View style={styles.mainTokenArea}>
                  <Text style={styles.tokenLabel}>{t('staffToken') || "TOKEN"}</Text>
                  <Text style={styles.largeToken}>{formatTokenId(activePatient.id)}</Text>
                  <View style={[styles.priorityBadge, { backgroundColor: getPriorityColors(activePatient.type).bg }]}>
                    <Text style={[styles.priorityText, { color: getPriorityColors(activePatient.type).text }]}>
                      {t(activePatient.type === 'emergency' ? 'emgEmergency' : activePatient.type === 'disabled' ? 'pdDisabled' : 'pdCommon') || getPriorityColors(activePatient.type).name}
                    </Text>
                  </View>
                </View>

                <View style={styles.patientDetails}>
                  <Text style={styles.patientName}>{activePatient.patient?.name || "Patient Name"}</Text>
                  <Text style={styles.patientAge}>
                    {activePatient.patient?.age || "--"} {t('staffYrs') || "Yrs"} • {t(activePatient.patient?.gender === 'male' ? 'emgMale' : activePatient.patient?.gender === 'female' ? 'emgFemale' : activePatient.patient?.gender === 'other' ? 'emgOther' : '') || activePatient.patient?.gender?.charAt(0).toUpperCase() || "U"}
                  </Text>
                  <View style={styles.infoRow}>
                    <Stethoscope size={14} color="#64748b" />
                    <Text style={styles.infoText}>{t(activePatient.primaryDepartment === 'Emergency' ? 'pdEmergency' : activePatient.primaryDepartment === 'Pediatrics' ? 'Pediatrics' : 'pdCommon') || activePatient.primaryDepartment || "General Consultation"}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Activity size={14} color="#64748b" />
                    <Text style={styles.infoText} numberOfLines={1}>
                      {t('staffSymptoms') || "Symptoms"}: {activePatient.symptoms || "Standard check-up"}
                    </Text>
                  </View>
                  <View style={styles.verifyContainer}>
                    <Text style={styles.verifyText}>ID: {activePatient.id.substring(0, 8).toUpperCase()}</Text>
                  </View>
                </View>
              </View>
            </Card>

            {/* 3. MAIN ACTION AREA */}
            <View style={styles.mainActionArea}>
              <TouchableOpacity
                style={[styles.primaryActionBtn, prescriptionMode ? styles.activeActionBtn : null]}
                onPress={() => setPrescriptionMode(prescriptionMode ? null : 'template')}
              >
                <FileText size={20} color={prescriptionMode ? "#fff" : "#2563eb"} />
                <Text style={[styles.primaryActionText, prescriptionMode && { color: "#fff" }]}>{t('staffPrescription') || "Prescription"}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.completeBtn} onPress={handleMarkComplete}>
                <CheckCircle2 size={24} color="#fff" />
                <Text style={styles.completeBtnText}>{t('staffMarkComplete') || "Mark Complete"}</Text>
              </TouchableOpacity>
            </View>

            {/* QR Scanner Section */}
            <TouchableOpacity style={styles.scanQrBtn} onPress={openScanner}>
              <QrCode size={20} color="#fff" />
              <Text style={styles.scanQrBtnText}>{t('staffScanQrCode') || "Scan QR Code"}</Text>
            </TouchableOpacity>

            {/* QR Scanner Camera */}
            {scannerOpen && (
              <View style={styles.scannerContainer}>
                <View style={styles.scannerHeader}>
                  <Text style={styles.scannerTitle}>📷 {t('staffScanning') || "Scanning..."}</Text>
                  <TouchableOpacity onPress={closeScanner} style={styles.closeScannerBtn}>
                    <Text style={styles.closeScannerText}>✕ {t('staffClose') || "Close"}</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.cameraWrapper}>
                  <CameraView
                    style={styles.camera}
                    facing="back"
                    barcodeScannerSettings={{
                      barcodeTypes: ["qr"],
                    }}
                    onBarcodeScanned={handleBarCodeScanned}
                  />
                  {/* Scan overlay frame */}
                  <View style={styles.scanOverlay}>
                    <View style={styles.scanFrame}>
                      <View style={[styles.scanCorner, styles.scanCornerTL]} />
                      <View style={[styles.scanCorner, styles.scanCornerTR]} />
                      <View style={[styles.scanCorner, styles.scanCornerBL]} />
                      <View style={[styles.scanCorner, styles.scanCornerBR]} />
                    </View>
                    <Text style={styles.scanHintText}>{t('staffAlignFrame') || "Align QR code within the frame"}</Text>
                  </View>
                </View>
              </View>
            )}


            {/* Scan Result: Completed Patient */}
            {lastScannedPatient && (
              <View style={styles.scanResultContainer}>
                <View style={styles.completedCard}>
                  <View style={styles.completedHeader}>
                    <CheckCircle2 size={20} color="#16a34a" />
                    <Text style={styles.completedHeaderText}>{t('staffAppCompleted') || "Appointment Completed"}</Text>
                  </View>
                  <View style={styles.completedBody}>
                    <View style={styles.completedTokenCircle}>
                      <Text style={styles.completedTokenText}>{formatTokenId(lastScannedPatient.id)}</Text>
                    </View>
                    <View style={styles.completedInfo}>
                      <Text style={styles.completedName}>{lastScannedPatient.patient?.name || "Patient"}</Text>
                      <Text style={styles.completedDetail}>
                        {lastScannedPatient.patient?.age || "--"} {t('staffYrs') || "Yrs"} • {lastScannedPatient.primaryDepartment || "General"}
                      </Text>
                      <View style={styles.completedBadge}>
                        <Text style={styles.completedBadgeText}>✓ {t('done') || "Done"}</Text>
                      </View>
                    </View>
                  </View>
                </View>

                {/* Next Patient's Turn */}
                {nextPatientAfterScan ? (
                  <View style={styles.nextPatientCard}>
                    <View style={styles.nextPatientHeader}>
                      <Activity size={18} color="#2563eb" />
                      <Text style={styles.nextPatientHeaderText}>{t('staffNextPatient') || "Next Patient's Turn"}</Text>
                    </View>
                    <View style={styles.nextPatientBody}>
                      <View style={[styles.nextTokenCircle, { backgroundColor: getPriorityColors(nextPatientAfterScan.type).bg }]}>
                        <Text style={[styles.nextTokenText, { color: getPriorityColors(nextPatientAfterScan.type).text }]}>
                          {formatTokenId(nextPatientAfterScan.id)}
                        </Text>
                      </View>
                      <View style={styles.nextPatientInfo}>
                        <Text style={styles.nextPatientName}>{nextPatientAfterScan.patient?.name || "Patient"}</Text>
                        <Text style={styles.nextPatientDetail}>
                          {nextPatientAfterScan.patient?.age || "--"} {t('staffYrs') || "Yrs"} • {nextPatientAfterScan.primaryDepartment || "General"}
                        </Text>
                      </View>
                      <View style={[styles.nextPriorityBadge, { borderColor: getPriorityColors(nextPatientAfterScan.type).border }]}>
                        <Text style={[styles.nextPriorityText, { color: getPriorityColors(nextPatientAfterScan.type).text }]}>
                          {t(nextPatientAfterScan.type === 'emergency' ? 'emgEmergency' : nextPatientAfterScan.type === 'disabled' ? 'pdDisabled' : 'pdCommon') || getPriorityColors(nextPatientAfterScan.type).name}
                        </Text>
                      </View>
                    </View>
                  </View>
                ) : (
                  <View style={styles.noMorePatientsCard}>
                    <CheckCircle2 size={24} color="#22c55e" />
                    <Text style={styles.noMorePatientsText}>{t('staffAllCompleted') || "All appointments completed! 🎉"}</Text>
                  </View>
                )}

              </View>
            )}

            {/* 4. PRESCRIPTION PANEL */}
            {prescriptionMode && (
              <View style={styles.prescriptionPanel}>
                {/* 3 Row-wise options */}
                <View style={styles.prescriptionTabs}>
                  <TouchableOpacity
                    style={[styles.tabBtn, prescriptionMode === 'template' && styles.activeTab]}
                    onPress={() => setPrescriptionMode('template')}
                  >
                    <Text style={[styles.tabText, prescriptionMode === 'template' && styles.activeTabText]}>{t('useTemplate') || "Template"}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.tabBtn, prescriptionMode === 'upload' && styles.activeTab]}
                    onPress={() => setPrescriptionMode('upload')}
                  >
                    <Text style={[styles.tabText, prescriptionMode === 'upload' && styles.activeTabText]}>{t('uploadPrescription') || "Upload"}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.tabBtn, prescriptionMode === 'scan' && styles.activeTab]}
                    onPress={() => setPrescriptionMode('scan')}
                  >
                    <Text style={[styles.tabText, prescriptionMode === 'scan' && styles.activeTabText]}>{t('scanQr') || "Scan"}</Text>
                  </TouchableOpacity>
                </View>


                {/* 4A. USE PRESCRIPTION TEMPLATE */}
                {prescriptionMode === 'template' && (
                  <View style={styles.panelContent}>
                    <Text style={styles.subTitle}>{t('staffQuickTemplates') || "Quick Templates"}</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsContainer}>
                      {TEMPLATES.map((tmpl, idx) => (
                        <TouchableOpacity key={idx} style={styles.chip} onPress={() => handleApplyTemplate(tmpl)}>
                          <Text style={styles.chipText}>{tmpl.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>

                    <Text style={styles.label}>{t('staffDiagnosis') || "Problem / Diagnosis"}</Text>
                    <TextInput
                      style={styles.inputArea}
                      value={diagnosis}
                      onChangeText={setDiagnosis}
                      placeholder={t('staffDiagnosisPlaceholder') || "Enter diagnosis..."}
                    />

                    <Text style={[styles.label, { marginTop: 12 }]}>{t('staffMedicinesDosage') || "Medicines & Dosage"}</Text>
                    {medicines.map((med, index) => (
                      <View key={index} style={styles.medicineRow}>
                        <TextInput
                          style={[styles.inputField, { flex: 2 }]}
                          placeholder={t('staffMedicineName') || "Medicine Name"}
                          value={med.name}
                          onChangeText={(v) => updateMedicine(index, 'name', v)}
                        />
                        <View style={styles.medCol}>
                          <TextInput
                            style={[styles.inputField, { marginBottom: 4 }]}
                            placeholder={t('staffDosagePlaceholder') || "Dosage (e.g., 1-0-1)"}
                            value={med.dosage}
                            onChangeText={(v) => updateMedicine(index, 'dosage', v)}
                          />
                          <View style={styles.quickDosages}>
                            {QUICK_DOSAGE.map(q => (
                              <TouchableOpacity key={q} style={styles.dosageChip} onPress={() => updateMedicine(index, 'dosage', q)}>
                                <Text style={styles.dosageChipText}>{q}</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </View>
                        <TextInput
                          style={[styles.inputField, { flex: 0.8 }]}
                          placeholder={t('staffDays') || "Days"}
                          value={med.days}
                          keyboardType="numeric"
                          onChangeText={(v) => updateMedicine(index, 'days', v)}
                        />
                      </View>
                    ))}
                    <TouchableOpacity style={styles.addMedBtn} onPress={addMedicineRow}>
                      <Plus size={16} color="#2563eb" />
                      <Text style={styles.addMedText}>{t('staffAddMedicine') || "Add Medicine"}</Text>
                    </TouchableOpacity>

                    <Text style={[styles.label, { marginTop: 12 }]}>{t('staffAdvice') || "Advice / Precautions"}</Text>
                    <TextInput
                      style={[styles.inputArea, { height: 60 }]}
                      value={advice}
                      onChangeText={setAdvice}
                      placeholder={t('staffAdvicePlaceholder') || "Write short advice..."}
                      multiline
                    />

                    <TouchableOpacity style={styles.saveRxBtn} onPress={handleSavePrescription}>
                      <Save size={18} color="#fff" style={{ marginRight: 8 }} />
                      <Text style={styles.saveRxText}>{t('staffSavePrescription') || "Save Prescription"}</Text>
                    </TouchableOpacity>
                  </View>

                )}

                {/* 4B. UPLOAD PRESCRIPTION */}
                {prescriptionMode === 'upload' && (
                  <View style={styles.panelContent}>
                    <View style={styles.uploadArea}>
                      <Upload size={48} color="#94a3b8" style={{ marginBottom: 12 }} />
                      <Text style={styles.uploadText}>{t('staffUploadDesc') || "Tap to choose Image or PDF"}</Text>
                      <TouchableOpacity style={styles.chooseFileBtn}>
                        <Text style={styles.chooseFileText}>{t('staffChooseFile') || "Choose File"}</Text>
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity style={styles.saveRxBtn} onPress={handleSavePrescription}>
                      <Save size={18} color="#fff" style={{ marginRight: 8 }} />
                      <Text style={styles.saveRxText}>{t('staffSavePrescription') || "Save Prescription"}</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* 4C. SCAN PRESCRIPTION */}
                {prescriptionMode === 'scan' && (
                  <View style={styles.panelContent}>
                    <View style={styles.scanArea}>
                      <Camera size={48} color="#94a3b8" style={{ marginBottom: 12 }} />
                      <Text style={styles.uploadText}>{t('staffCameraPreview') || "Camera Preview"}</Text>
                      <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
                        <TouchableOpacity style={[styles.chooseFileBtn, { backgroundColor: '#e2e8f0' }]}>
                          <Text style={[styles.chooseFileText, { color: '#475569' }]}>{t('staffStartCamera') || "Start Camera"}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.chooseFileBtn}>
                          <Text style={styles.chooseFileText}>{t('staffCaptureScan') || "Capture Scan"}</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                    <TouchableOpacity style={styles.saveRxBtn} onPress={handleSavePrescription}>
                      <Save size={18} color="#fff" style={{ marginRight: 8 }} />
                      <Text style={styles.saveRxText}>{t('staffSavePrescription') || "Save Prescription"}</Text>
                    </TouchableOpacity>
                  </View>
                )}

              </View>
            )}

          </View>
        ) : (
          <View style={styles.emptyState}>
            <CheckCircle2 size={64} color="#22c55e" style={{ marginBottom: 16 }} />
            <Text style={styles.emptyTitle}>{t('staffQueueClear') || "Queue Clear"}</Text>
            <Text style={styles.emptySub}>{t('staffNoPatientsWaiting') || "No patients waiting for consultation."}</Text>
          </View>
        )}

        {/* 5. UPCOMING QUEUE SECTION */}
        <View style={styles.queueSection}>
          <Text style={styles.sectionTitle}>{t('staffUpcomingQueue') || "Upcoming Queue"} ({t('active').toLowerCase() || "all"} {upcomingQueue.length})</Text>
          <ScrollView
            style={styles.upcomingQueueScroll}
            showsVerticalScrollIndicator={true}
            nestedScrollEnabled={true}
          >
            {upcomingQueue.map((item) => (
              <View key={item.id} style={styles.queueItem}>
                <View style={[styles.smallTokenCircle, { backgroundColor: getPriorityColors(item.type).bg }]}>
                  <Text style={[styles.smallTokenText, { color: getPriorityColors(item.type).text }]}>
                    {formatTokenId(item.id)}
                  </Text>
                </View>
                <View style={styles.queueItemInfo}>
                  <Text style={styles.queueItemName}>{item.patient?.name || "Patient"}</Text>
                  <Text style={styles.queueItemType}>{t(item.primaryDepartment === 'Emergency' ? 'pdEmergency' : item.primaryDepartment === 'Pediatrics' ? 'Pediatrics' : 'pdCommon') || item.primaryDepartment || "General"}</Text>
                </View>
                <View style={[styles.queueBadge, { borderColor: getPriorityColors(item.type).border }]}>
                  <Text style={[styles.queueBadgeText, { color: getPriorityColors(item.type).text }]}>
                    {t(item.type === 'emergency' ? 'emgEmergency' : item.type === 'disabled' ? 'pdDisabled' : 'pdCommon') || getPriorityColors(item.type).name}
                  </Text>
                </View>
              </View>
            ))}
            {upcomingQueue.length === 0 && (
              <Text style={styles.emptyQueueText}>{t('staffNoUpcoming') || "No upcoming patients."}</Text>
            )}
          </ScrollView>
        </View>


      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  header: {
    backgroundColor: "#ffffff",
    paddingTop: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backBtn: { padding: 8, marginRight: 8, backgroundColor: "#f1f5f9", borderRadius: 8 },
  headerInfo: { flex: 1 },
  dashboardTitle: { fontSize: 20, fontWeight: "700", color: "#0f172a" },
  doctorName: { fontSize: 13, color: "#64748b", marginTop: 2, fontWeight: "500" },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  iconBtn: { padding: 8, backgroundColor: "#f1f5f9", borderRadius: 8, flexDirection: "row", alignItems: "center" },
  langText: { fontSize: 12, fontWeight: "bold", marginLeft: 4, color: "#1e293b" },
  statsBar: {
    backgroundColor: "#f8fafc",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  waitCountText: { fontSize: 13, color: "#475569" },
  scrollContent: { padding: 16, paddingBottom: 60 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#334155", marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.5 },
  activePatientContainer: { marginBottom: 24 },
  activeCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 16,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  activeCardContent: { flexDirection: "row", padding: 16 },
  mainTokenArea: {
    alignItems: "center",
    justifyContent: "center",
    paddingRight: 16,
    borderRightWidth: 1,
    borderRightColor: "#e2e8f0",
  },
  tokenLabel: { fontSize: 11, color: "#64748b", fontWeight: "700", letterSpacing: 1 },
  largeToken: { fontSize: 36, fontWeight: "900", color: "#0f172a", marginVertical: 4 },
  priorityBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  priorityText: { fontSize: 11, fontWeight: "700" },
  patientDetails: { flex: 1, paddingLeft: 16, justifyContent: "center" },
  patientName: { fontSize: 20, fontWeight: "700", color: "#1e293b", marginBottom: 2 },
  patientAge: { fontSize: 14, color: "#64748b", fontWeight: "600", marginBottom: 8 },
  infoRow: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  infoText: { fontSize: 13, color: "#475569", marginLeft: 6 },
  verifyContainer: { marginTop: 8, backgroundColor: "#f1f5f9", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, alignSelf: "flex-start" },
  verifyText: { fontSize: 11, color: "#475569", fontWeight: "600", letterSpacing: 0.5 },
  mainActionArea: { flexDirection: "row", gap: 12, marginBottom: 12 },
  primaryActionBtn: {
    flex: 1,
    backgroundColor: "#eff6ff",
    borderColor: "#bfdbfe",
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  activeActionBtn: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  primaryActionText: { fontSize: 16, fontWeight: "700", color: "#2563eb" },
  completeBtn: {
    flex: 1,
    backgroundColor: "#16a34a",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  completeBtnText: { fontSize: 16, fontWeight: "700", color: "#ffffff" },
  scanQrBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: "#7c3aed",
    borderRadius: 12,
    marginBottom: 12,
    elevation: 3,
    shadowColor: "#7c3aed",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  scanQrBtnText: { fontSize: 16, fontWeight: "700", color: "#ffffff" },
  scannerContainer: {
    backgroundColor: "#0f172a",
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 16,
  },
  scannerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  scannerTitle: { fontSize: 16, fontWeight: "700", color: "#ffffff" },
  closeScannerBtn: {
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  closeScannerText: { color: "#ffffff", fontSize: 14, fontWeight: "600" },
  cameraWrapper: {
    height: 280,
    position: "relative",
  },
  camera: {
    flex: 1,
  },
  scanOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  scanFrame: {
    width: 200,
    height: 200,
    position: "relative",
  },
  scanCorner: {
    position: "absolute",
    width: 30,
    height: 30,
    borderColor: "#7c3aed",
  },
  scanCornerTL: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 8 },
  scanCornerTR: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 8 },
  scanCornerBL: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 8 },
  scanCornerBR: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 8 },
  scanHintText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 13,
    fontWeight: "500",
    marginTop: 24,
    textAlign: "center",
  },
  scanResultContainer: {
    gap: 12,
    marginBottom: 12,
  },
  completedCard: {
    backgroundColor: "#f0fdf4",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#bbf7d0",
    padding: 16,
  },
  completedHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#dcfce7",
  },
  completedHeaderText: { fontSize: 15, fontWeight: "700", color: "#15803d" },
  completedBody: { flexDirection: "row", alignItems: "center" },
  completedTokenCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#dcfce7",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  completedTokenText: { fontSize: 18, fontWeight: "900", color: "#16a34a" },
  completedInfo: { flex: 1 },
  completedName: { fontSize: 17, fontWeight: "700", color: "#166534", marginBottom: 2 },
  completedDetail: { fontSize: 13, color: "#4ade80", fontWeight: "500" },
  completedBadge: {
    backgroundColor: "#16a34a",
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 6,
  },
  completedBadgeText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  nextPatientCard: {
    backgroundColor: "#eff6ff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    padding: 16,
  },
  nextPatientHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#dbeafe",
  },
  nextPatientHeaderText: { fontSize: 15, fontWeight: "700", color: "#1d4ed8" },
  nextPatientBody: { flexDirection: "row", alignItems: "center" },
  nextTokenCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  nextTokenText: { fontSize: 16, fontWeight: "800" },
  nextPatientInfo: { flex: 1 },
  nextPatientName: { fontSize: 16, fontWeight: "700", color: "#1e293b", marginBottom: 2 },
  nextPatientDetail: { fontSize: 13, color: "#64748b", fontWeight: "500" },
  nextPriorityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  nextPriorityText: { fontSize: 11, fontWeight: "700" },
  noMorePatientsCard: {
    backgroundColor: "#f0fdf4",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#bbf7d0",
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  noMorePatientsText: { fontSize: 15, fontWeight: "600", color: "#15803d" },
  prescriptionPanel: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginTop: 8,
    overflow: "hidden",
  },
  prescriptionTabs: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  tabBtn: { flex: 1, paddingVertical: 14, alignItems: "center", borderBottomWidth: 2, borderBottomColor: "transparent" },
  activeTab: { borderBottomColor: "#2563eb" },
  tabText: { fontSize: 14, fontWeight: "600", color: "#64748b" },
  activeTabText: { color: "#2563eb" },
  panelContent: { padding: 16 },
  subTitle: { fontSize: 14, fontWeight: "700", color: "#334155", marginBottom: 12 },
  chipsContainer: { flexDirection: "row", marginBottom: 16 },
  chip: {
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  chipText: { fontSize: 13, color: "#334155", fontWeight: "500" },
  label: { fontSize: 13, fontWeight: "600", color: "#475569", marginBottom: 6 },
  inputArea: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: "#1e293b",
  },
  medicineRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  medCol: { flex: 1.5, flexDirection: "column" },
  inputField: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: "#1e293b",
  },
  quickDosages: { flexDirection: "row", gap: 4, flexWrap: "wrap", marginBottom: 4 },
  dosageChip: { backgroundColor: "#e0e7ff", paddingHorizontal: 6, paddingVertical: 4, borderRadius: 4 },
  dosageChipText: { fontSize: 10, color: "#4f46e5", fontWeight: "600" },
  addMedBtn: { flexDirection: "row", alignItems: "center", paddingVertical: 8, gap: 4 },
  addMedText: { color: "#2563eb", fontSize: 13, fontWeight: "600" },
  saveRxBtn: {
    backgroundColor: "#0f172a",
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    marginTop: 16,
  },
  saveRxText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  uploadArea: { alignItems: "center", justifyContent: "center", padding: 32, backgroundColor: "#f8fafc", borderWidth: 2, borderStyle: "dashed", borderColor: "#cbd5e1", borderRadius: 12 },
  scanArea: { alignItems: "center", justifyContent: "center", padding: 32, backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 12 },
  uploadText: { fontSize: 14, color: "#64748b", marginBottom: 16 },
  chooseFileBtn: { backgroundColor: "#2563eb", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  chooseFileText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  queueSection: { marginTop: 16 },
  queueItem: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  smallTokenCircle: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", marginRight: 12 },
  smallTokenText: { fontSize: 14, fontWeight: "800" },
  queueItemInfo: { flex: 1 },
  queueItemName: { fontSize: 15, fontWeight: "700", color: "#1e293b", marginBottom: 2 },
  queueItemType: { fontSize: 13, color: "#64748b" },
  queueBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
  queueBadgeText: { fontSize: 10, fontWeight: "700" },
  emptyQueueText: { fontSize: 14, color: "#94a3b8", fontStyle: "italic", textAlign: "center", marginTop: 12 },
  emptyState: { alignItems: "center", justifyContent: "center", padding: 40, backgroundColor: "#fff", borderRadius: 16, marginBottom: 24, borderWidth: 1, borderColor: "#e2e8f0" },
  emptyTitle: { fontSize: 22, fontWeight: "700", color: "#0f172a", marginBottom: 8 },
  emptySub: { fontSize: 15, color: "#64748b", textAlign: "center" },
  upcomingQueueScroll: { maxHeight: 350, marginTop: 4 },
});

// ─── EMERGENCY ALERTS STYLES ───
const eaStyles = StyleSheet.create({
  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#dc2626', textTransform: 'uppercase', letterSpacing: 0.5 },
  alertCard: {
    borderRadius: 14,
    borderWidth: 2,
    padding: 16,
    marginBottom: 12,
  },
  alertHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  severityBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  severityBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  alertType: { fontSize: 18, fontWeight: '800', marginBottom: 4 },
  patientName: { fontSize: 15, fontWeight: '600', color: '#1e293b', marginBottom: 8 },
  conditionText: { fontSize: 13, color: '#475569', marginBottom: 10, lineHeight: 18, backgroundColor: 'rgba(255,255,255,0.6)', padding: 8, borderRadius: 8 },
  detailsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  detailChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.7)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)' },
  detailChipText: { fontSize: 12, color: '#334155', fontWeight: '500' },
  assistanceRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 8 },
  assistanceLabel: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  assistanceText: { fontSize: 12, color: '#475569', flex: 1 },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)' },
  timeText: { fontSize: 11, color: '#64748b', fontWeight: '500' },
  ackText: { fontSize: 11, color: '#2563eb', fontWeight: '600' },
  actionsRow: { flexDirection: 'row', gap: 8 },
  ackBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#2563eb', paddingVertical: 10, borderRadius: 10 },
  inProgressBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#ea580c', paddingVertical: 10, borderRadius: 10 },
  resolveBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#16a34a', paddingVertical: 10, borderRadius: 10 },
  ackBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});

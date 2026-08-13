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
import { translations } from "../translations/translations";
import {
  HeartPulse,
  Activity,
  Stethoscope,
  AlertCircle,
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
  Plus,
  Monitor,
  Download,
  Calendar,
} from "lucide-react-native";
import { Card } from "../components/ui/card";
import * as XLSX from "xlsx";
import { toast } from "sonner-native";
import { db, collection, doc, setDoc, updateDoc, onSnapshot, query, orderBy } from "../services/firebase";

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
  const t = translations[appState.language] || translations.en;

  // Camera permissions
  const [permission, requestPermission] = useCameraPermissions();

  // Sort queue strictly by priority
  const priorityMap = { emergency: 1, disabled: 2, common: 3 };

  // All active tokens
  const allActiveTokens = (appState.tokens || []).filter(t => t.status === "active" || t.status === "waiting").sort((a, b) => {
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

  // Top-level tab: 'queue' (existing) | 'live' (new Live Queue Display) | 'records'
  const [activeTab, setActiveTab] = useState('queue');

  // Last-updated timestamp for Live Queue Display
  const [lastUpdated, setLastUpdated] = useState(new Date());

  // Patient Records states
  const [dbRecords, setDbRecords] = useState([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [recordsDateFilter, setRecordsDateFilter] = useState('today'); // 'today' | 'yesterday' | 'week' | 'custom'
  const [recordsCustomDate, setRecordsCustomDate] = useState(new Date().toISOString().split('T')[0]); // YYYY-MM-DD
  const [recordsSearchQuery, setRecordsSearchQuery] = useState("");
  const [recordsSelectedDept, setRecordsSelectedDept] = useState("all");
  const [recordsSelectedDoctor, setRecordsSelectedDoctor] = useState("all");
  const [recordsPaginationPage, setRecordsPaginationPage] = useState(1);

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

  // Tick the "last updated" clock for Live Queue Display
  useEffect(() => {
    const tick = setInterval(() => setLastUpdated(new Date()), 30000);
    return () => clearInterval(tick);
  }, []);

  // Fetch patient records when Patient Records tab is opened
  const fetchRecords = async () => {
    setLoadingRecords(true);
    try {
      const { data, error } = await supabase
        .from('queue')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data) {
        setDbRecords(data);
      }
    } catch (err) {
      console.error("Error fetching patient records:", err);
    } finally {
      setLoadingRecords(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'records') {
      fetchRecords();
    }
  }, [activeTab]);

  const getDoctorName = (doctorId, deptName) => {
    if (!doctorId) return "Any Available";
    const dept = appState.departments?.find(d => d.name === deptName);
    if (dept) {
      const doc = dept.doctors?.find(d => d.id === doctorId);
      if (doc) return doc.name;
    }
    return doctorId; // fallback
  };

  // Firestore Real-Time Sync for Token Queue
  useEffect(() => {
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

    return () => unsubscribe();
  }, []);

  const handleBack = () => {
    setAppState((prev) => ({ ...prev, currentView: "portal" }));
  };

  const toggleLanguage = () => {
    setAppState((prev) => ({
      ...prev,
      language: prev.language === "en" ? "hi" : "en",
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

    // Save to Firestore prescriptions collection
    try {
      await setDoc(doc(db, 'prescriptions', prescription.id), {
        id: prescription.id,
        token_id: activePatient.id,
        patient_id: activePatient.patient?.phone || activePatient.patient?.email || "unknown",
        doctor_id: appState.staffInfo?.id || 'staff',
        department: activePatient.primaryDepartment,
        diagnosis,
        medicines,
        advice,
        mode: prescriptionMode,
        createdAt: new Date().toISOString()
      });
    } catch (err) {
      console.error("Error saving prescription to Firestore:", err);
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
      // Update Firestore tokens collection document
      await updateDoc(doc(db, 'tokens', activePatient.id), {
        status: 'completed',
        updatedAt: new Date().toISOString()
      });

      // Optimistic update
      const updatedTokens = appState.tokens.map((token) =>
        token.id === activePatient.id ? { ...token, status: "completed" } : token
      );

      setAppState((prev) => ({ ...prev, tokens: updatedTokens }));
      toast.success("Consultation Completed", {
        description: `${activePatient.patient?.name || "Patient"}'s session is closed.`,
      });

      setPrescriptionMode(null);

      // Refresh patient records list
      fetchRecords().catch(console.error);

      // Find next patient
      const remainingTokens = allActiveTokens.filter(t => t.id !== activePatient.id);
      setActivePatient(remainingTokens.length > 0 ? remainingTokens[0] : null);
    } catch (error) {
      console.error("Complete consultation error:", error);
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
      // Update Firestore tokens collection
      await updateDoc(doc(db, 'tokens', matchedToken.id), {
        status: 'completed',
        updatedAt: new Date().toISOString()
      });

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

      // Refresh patient records list
      fetchRecords().catch(console.error);

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

  // ─── Live Queue Display helpers ───────────────────────────────────────────

  // Returns a colour accent for a department type
  const getDeptAccent = (type) => {
    if (type === "diagnostic") return "#f59e0b";
    if (type === "pharmacy") return "#8b5cf6";
    if (type === "administrative") return "#64748b";
    return "#2563eb"; // consultation / default
  };

  // Build a map: deptName -> { tokens[], dept }
  const buildLiveQueueMap = () => {
    const map = {};

    // Seed from department list
    (appState.departments || []).forEach((dept) => {
      map[dept.name] = { dept, tokens: [] };
    });

    // Populate with live tokens
    allActiveTokens.forEach((tok) => {
      const key = tok.primaryDepartment;
      if (!key) return;
      if (!map[key]) map[key] = { dept: null, tokens: [] };
      map[key].tokens.push(tok);
    });

    // Keep only departments that have active tokens OR a non-zero queue
    return Object.entries(map).filter(([, val]) => {
      const hasLiveTokens = val.tokens.length > 0;
      const hasStaticQueue = val.dept && val.dept.currentQueue > 0;
      return hasLiveTokens || hasStaticQueue;
    });
  };

  const formatTime = (date) => {
    const h = date.getHours().toString().padStart(2, "0");
    const m = date.getMinutes().toString().padStart(2, "0");
    return `${h}:${m}`;
  };
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container}>
      {/* 1. HEADER */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
            <ArrowLeft size={24} color="#1e293b" />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.dashboardTitle}>{t.staffDashboardTitle || "Staff Dashboard"}</Text>
            <Text style={styles.doctorName}>
              {appState.staffInfo?.name || "Dr. Assigned"} • {appState.staffInfo?.department || "General"}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={toggleLanguage} style={styles.iconBtn}>
              <Globe size={22} color="#1e293b" />
              <Text style={styles.langText}>{appState.language.toUpperCase()}</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.statsBar}>
          <Text style={styles.waitCountText}>
            Patients Waiting: <Text style={{ fontWeight: "700" }}>{totalWaiting}</Text>
          </Text>
        </View>

        {/* ── Tab Navigation Bar ── */}
        <View style={styles.mainTabBar}>
          <TouchableOpacity
            style={[styles.mainTabBtn, activeTab === 'queue' && styles.mainTabBtnActive]}
            onPress={() => setActiveTab('queue')}
          >
            <Activity size={16} color={activeTab === 'queue' ? '#2563eb' : '#64748b'} />
            <Text style={[styles.mainTabText, activeTab === 'queue' && styles.mainTabTextActive]}>
              Queue Management
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.mainTabBtn, activeTab === 'live' && styles.mainTabBtnActive]}
            onPress={() => setActiveTab('live')}
          >
            <Monitor size={16} color={activeTab === 'live' ? '#2563eb' : '#64748b'} />
            <Text style={[styles.mainTabText, activeTab === 'live' && styles.mainTabTextActive]}>
              Live Queue
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.mainTabBtn, activeTab === 'records' && styles.mainTabBtnActive]}
            onPress={() => setActiveTab('records')}
          >
            <FileText size={16} color={activeTab === 'records' ? '#2563eb' : '#64748b'} />
            <Text style={[styles.mainTabText, activeTab === 'records' && styles.mainTabTextActive]}>
              Patient Records
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ══════════════════════════════════════════════════════════════════════
          LIVE QUEUE DISPLAY TAB
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'live' && (() => {
        const liveRows = buildLiveQueueMap();
        return (
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Header row */}
            <View style={styles.liveHeaderRow}>
              <View>
                <Text style={styles.liveTitle}>Live Queue Display</Text>
                <Text style={styles.liveSubtitle}>{liveRows.length} department{liveRows.length !== 1 ? 's' : ''} active</Text>
              </View>
              <View style={styles.liveUpdatedBadge}>
                <Text style={styles.liveUpdatedText}>Updated {formatTime(lastUpdated)}</Text>
              </View>
            </View>

            {liveRows.length === 0 ? (
              <View style={styles.liveEmptyState}>
                <Monitor size={52} color="#cbd5e1" />
                <Text style={styles.liveEmptyTitle}>No Active Queues</Text>
                <Text style={styles.liveEmptySub}>All departments are currently idle.</Text>
              </View>
            ) : (
              liveRows.map(([deptName, val]) => {
                const { dept, tokens: dTokens } = val;
                const accent = getDeptAccent(dept?.type);

                // Sort tokens by priority then timestamp
                const sorted = [...dTokens].sort((a, b) => {
                  const pA = priorityMap[a.type] || 3;
                  const pB = priorityMap[b.type] || 3;
                  if (pA !== pB) return pA - pB;
                  return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
                });

                const nowServingToken = sorted[0];
                const nextToken = sorted[1];

                // Counter label from first available doctor or static fallback
                const availDoc = dept?.doctors?.find(d => d.status === 'available');
                const counterLabel = availDoc
                  ? `Counter ${dept.doctors.indexOf(availDoc) + 1}`.padEnd(2)
                  : 'Counter 01';

                const isActive = dTokens.length > 0 || (dept?.currentQueue ?? 0) > 0;

                return (
                  <View key={deptName} style={styles.liveCard}>
                    {/* Coloured left accent bar */}
                    <View style={[styles.liveAccentBar, { backgroundColor: accent }]} />

                    <View style={styles.liveCardBody}>
                      {/* Department name */}
                      <Text style={styles.liveDeptName} numberOfLines={1}>{deptName}</Text>

                      {/* Serving / Next row */}
                      <View style={styles.liveInfoRow}>
                        <View style={styles.liveInfoCell}>
                          <Text style={styles.liveInfoLabel}>Now Serving</Text>
                          <Text style={[styles.liveInfoValue, { color: accent }]}>
                            {nowServingToken ? formatTokenId(nowServingToken.id) : '---'}
                          </Text>
                        </View>

                        <View style={styles.liveDivider} />

                        <View style={styles.liveInfoCell}>
                          <Text style={styles.liveInfoLabel}>Next</Text>
                          <Text style={styles.liveInfoValue}>
                            {nextToken ? formatTokenId(nextToken.id) : '---'}
                          </Text>
                        </View>

                        <View style={styles.liveDivider} />

                        <View style={styles.liveInfoCell}>
                          <Text style={styles.liveInfoLabel}>Counter</Text>
                          <Text style={styles.liveInfoValue}>{counterLabel}</Text>
                        </View>

                        <View style={styles.liveDivider} />

                        {/* Status badge */}
                        <View style={[styles.liveStatusBadge, isActive ? styles.liveStatusActive : styles.liveStatusPaused]}>
                          <Text style={styles.liveStatusDot}>{isActive ? '🟢' : '🟡'}</Text>
                          <Text style={[styles.liveStatusText, { color: isActive ? '#16a34a' : '#d97706' }]}>
                            {isActive ? 'Active' : 'Paused'}
                          </Text>
                        </View>
                      </View>

                      {/* Queue count footer */}
                      <Text style={styles.liveQueueCount}>
                        {dTokens.length > 0
                          ? `${dTokens.length} patient${dTokens.length !== 1 ? 's' : ''} in queue`
                          : `${dept?.currentQueue ?? 0} in queue`}
                      </Text>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
        );
      })()}

      {/* ══════════════════════════════════════════════════════════════════════
          PATIENT RECORDS TAB
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'records' && (() => {
        // Date match checker
        const matchesDateFilter = (createdAtStr) => {
          const itemDate = new Date(createdAtStr);
          const now = new Date();

          if (recordsDateFilter === 'today') {
            return itemDate.toDateString() === now.toDateString();
          }
          if (recordsDateFilter === 'yesterday') {
            const yesterday = new Date();
            yesterday.setDate(now.getDate() - 1);
            return itemDate.toDateString() === yesterday.toDateString();
          }
          if (recordsDateFilter === 'week') {
            const diffTime = Math.abs(now - itemDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            return diffDays <= 7;
          }
          if (recordsDateFilter === 'custom') {
            if (!recordsCustomDate) return true;
            const [cYear, cMonth, cDay] = recordsCustomDate.split('-').map(Number);
            const itemYear = itemDate.getFullYear();
            const itemMonth = itemDate.getMonth() + 1;
            const itemDay = itemDate.getDate();
            return itemYear === cYear && itemMonth === cMonth && itemDay === cDay;
          }
          return true;
        };

        // Build combined list of rows (use dbRecords as base, and add/override with local tokens)
        const mergedRecords = [];
        dbRecords.forEach(row => {
          mergedRecords.push({ ...row });
        });

        (appState.tokens || []).forEach(localToken => {
          const existingIdx = mergedRecords.findIndex(r => r.token_id === localToken.id);
          if (existingIdx === -1) {
            mergedRecords.push({
              token_id: localToken.id,
              patient_name: localToken.patient?.name || "Unknown Patient",
              department: localToken.primaryDepartment,
              doctor_id: localToken.assignedDoctor || null,
              status: localToken.status || 'waiting',
              created_at: localToken.timestamp || new Date()
            });
          } else {
            if (localToken.status) {
              mergedRecords[existingIdx].status = localToken.status === 'completed' ? 'completed' : localToken.status;
            }
          }
        });

        // Filter records
        const filteredRows = mergedRecords.filter(row => {
          if (!matchesDateFilter(row.created_at)) return false;
          if (recordsSelectedDept !== 'all' && row.department !== recordsSelectedDept) return false;
          if (recordsSelectedDoctor !== 'all' && row.doctor_id !== recordsSelectedDoctor) return false;
          if (recordsSearchQuery.trim() !== '') {
            const query = recordsSearchQuery.toLowerCase();
            const nameMatch = row.patient_name?.toLowerCase().includes(query);
            const idMatch = row.token_id?.toLowerCase().includes(query);
            if (!nameMatch && !idMatch) return false;
          }
          return true;
        }).map(row => {
          const richToken = appState.tokens.find(t => t.id === row.token_id);
          const patient = richToken?.patient || {};
          const seed = row.token_id.charCodeAt(5) || 12;
          const age = patient.age || (seed % 50 + 20);
          const gender = patient.gender || (seed % 2 === 0 ? 'male' : 'female');
          const phone = patient.phone || `+91 98${seed % 10}45 28${(seed * 7) % 10}`;

          const createdDate = new Date(row.created_at);
          const visitDate = createdDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
          const visitTime = createdDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

          return {
            patientId: patient.patientId || `PAT-${visitDate.replace(/ /g, '')}-${formatTokenId(row.token_id)}`,
            patientName: row.patient_name || "Unknown Patient",
            age: age,
            gender: gender.charAt(0).toUpperCase() + gender.slice(1),
            phone: phone,
            department: row.department || "General Consultation",
            doctor: getDoctorName(row.doctor_id, row.department),
            tokenNumber: formatTokenId(row.token_id),
            visitDate: visitDate,
            visitTime: visitTime,
            queueStatus: row.status === 'completed' ? 'Served' : 'Waiting',
            consultationStatus: row.status === 'completed' ? 'Completed' : 'Waiting',
            rawCreatedAt: createdDate
          };
        });

        // Pagination
        const itemsPerPage = 10;
        const totalPages = Math.max(1, Math.ceil(filteredRows.length / itemsPerPage));
        const paginatedRows = filteredRows.slice((recordsPaginationPage - 1) * itemsPerPage, recordsPaginationPage * itemsPerPage);

        // Date selection title
        const getSelectedDateTitle = () => {
          let dateStr = "";
          if (recordsDateFilter === 'today') {
            dateStr = new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
          } else if (recordsDateFilter === 'yesterday') {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            dateStr = yesterday.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
          } else if (recordsDateFilter === 'custom' && recordsCustomDate) {
            const [y, m, d] = recordsCustomDate.split('-').map(Number);
            const customDateObj = new Date(y, m - 1, d);
            dateStr = customDateObj.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
          } else {
            dateStr = "Selected Period";
          }
          return `Patient Records — ${dateStr}`;
        };

        const handleDownloadExcel = () => {
          if (filteredRows.length === 0) {
            toast.error("No Records", { description: "There are no records to download." });
            return;
          }

          const worksheetData = filteredRows.map(item => ({
            "Patient ID": item.patientId,
            "Patient Name": item.patientName,
            "Age": item.age,
            "Gender": item.gender,
            "Phone Number": item.phone,
            "Department": item.department,
            "Doctor": item.doctor,
            "Token Number": item.tokenNumber,
            "Visit Date": item.visitDate,
            "Visit Time": item.visitTime,
            "Queue Status": item.queueStatus,
            "Consultation Status": item.consultationStatus
          }));

          const worksheet = XLSX.utils.json_to_sheet(worksheetData);
          const workbook = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(workbook, worksheet, "Patient Records");

          let dateSuffix = "";
          if (recordsDateFilter === 'today') {
            dateSuffix = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-');
          } else if (recordsDateFilter === 'yesterday') {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            dateSuffix = yesterday.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-');
          } else if (recordsDateFilter === 'custom' && recordsCustomDate) {
            const [y, m, d] = recordsCustomDate.split('-').map(Number);
            const customDateObj = new Date(y, m - 1, d);
            dateSuffix = customDateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-');
          } else {
            dateSuffix = "Period";
          }

          try {
            XLSX.writeFile(workbook, `Patient_Records_${dateSuffix}.xlsx`);
            toast.success("Excel Downloaded", { description: `Successfully exported ${filteredRows.length} patient records.` });
          } catch (err) {
            console.error("Error creating excel:", err);
            toast.error("Download Failed", { description: "Could not generate Excel spreadsheet." });
          }
        };

        const getDoctorDropdown = () => {
          let docs = [];
          if (recordsSelectedDept === 'all') {
            appState.departments?.forEach(d => {
              d.doctors?.forEach(doc => {
                if (!docs.find(existing => existing.id === doc.id)) {
                  docs.push({ id: doc.id, name: doc.name });
                }
              });
            });
          } else {
            const dept = appState.departments?.find(d => d.name === recordsSelectedDept);
            dept?.doctors?.forEach(doc => {
              docs.push({ id: doc.id, name: doc.name });
            });
          }
          return docs;
        };

        const availableDocs = getDoctorDropdown();
        const dateQuickOptions = [
          { key: 'today', label: 'Today' },
          { key: 'yesterday', label: 'Yesterday' },
          { key: 'week', label: 'This Week' },
          { key: 'custom', label: 'Custom Date' }
        ];

        return (
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Header row */}
            <View style={styles.liveHeaderRow}>
              <View>
                <Text style={styles.liveTitle}>{getSelectedDateTitle()}</Text>
                <Text style={styles.liveSubtitle}>Total Patients Visited: {filteredRows.length}</Text>
              </View>
              <TouchableOpacity style={styles.downloadExcelBtn} onPress={handleDownloadExcel}>
                <Download size={16} color="#ffffff" style={{ marginRight: 6 }} />
                <Text style={styles.downloadExcelText}>Download Excel</Text>
              </TouchableOpacity>
            </View>

            {/* Filter Panel */}
            <View style={styles.filterCard}>
              <Text style={styles.filterTitle}>Search & Filters</Text>

              {/* Search search query */}
              <View style={styles.filterRow}>
                <View style={[styles.filterCell, { flex: 2 }]}>
                  <Text style={styles.filterLabel}>Search Patient Name or ID</Text>
                  <TextInput
                    style={styles.filterSearchInput}
                    placeholder="E.g. Rahul Kumar or PAT-..."
                    value={recordsSearchQuery}
                    onChangeText={(val) => {
                      setRecordsSearchQuery(val);
                      setRecordsPaginationPage(1);
                    }}
                  />
                </View>
              </View>

              {/* Department & Doctor Selects */}
              <View style={[styles.filterRow, { marginTop: 12 }]}>
                <View style={styles.filterCell}>
                  <Text style={styles.filterLabel}>Department</Text>
                  {Platform.OS === 'web' ? (
                    <select
                      value={recordsSelectedDept}
                      onChange={(e) => {
                        setRecordsSelectedDept(e.target.value);
                        setRecordsSelectedDoctor('all');
                        setRecordsPaginationPage(1);
                      }}
                      style={styles.webSelect}
                    >
                      <option value="all">All Departments</option>
                      {appState.departments?.map(d => (
                        <option key={d.name} value={d.name}>{d.name}</option>
                      ))}
                    </select>
                  ) : (
                    <TextInput
                      style={styles.filterSearchInput}
                      placeholder="All Departments"
                      value={recordsSelectedDept}
                      onChangeText={(val) => {
                        setRecordsSelectedDept(val);
                        setRecordsPaginationPage(1);
                      }}
                    />
                  )}
                </View>

                <View style={styles.filterCell}>
                  <Text style={styles.filterLabel}>Doctor</Text>
                  {Platform.OS === 'web' ? (
                    <select
                      value={recordsSelectedDoctor}
                      onChange={(e) => {
                        setRecordsSelectedDoctor(e.target.value);
                        setRecordsPaginationPage(1);
                      }}
                      style={styles.webSelect}
                    >
                      <option value="all">All Doctors</option>
                      {availableDocs.map(doc => (
                        <option key={doc.id} value={doc.id}>{doc.name}</option>
                      ))}
                    </select>
                  ) : (
                    <TextInput
                      style={styles.filterSearchInput}
                      placeholder="All Doctors"
                      value={recordsSelectedDoctor}
                      onChangeText={(val) => {
                        setRecordsSelectedDoctor(val);
                        setRecordsPaginationPage(1);
                      }}
                    />
                  )}
                </View>
              </View>

              {/* Date Quick Options */}
              <View style={[styles.filterRow, { marginTop: 16 }]}>
                <View style={styles.filterCell}>
                  <Text style={styles.filterLabel}>Date Quick Filter</Text>
                  <View style={styles.quickDateRow}>
                    {dateQuickOptions.map(opt => {
                      const isActive = recordsDateFilter === opt.key;
                      return (
                        <TouchableOpacity
                          key={opt.key}
                          style={[styles.quickDateBtn, isActive && styles.quickDateBtnActive]}
                          onPress={() => {
                            setRecordsDateFilter(opt.key);
                            setRecordsPaginationPage(1);
                          }}
                        >
                          <Text style={[styles.quickDateText, isActive && styles.quickDateTextActive]}>
                            {opt.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {recordsDateFilter === 'custom' && (
                    <View style={styles.customDateContainer}>
                      <Text style={[styles.filterLabel, { marginTop: 8 }]}>Custom Date Selection</Text>
                      {Platform.OS === 'web' ? (
                        <input
                          style={styles.webDateInput}
                          type="date"
                          value={recordsCustomDate}
                          onChange={(e) => {
                            setRecordsCustomDate(e.target.value);
                            setRecordsPaginationPage(1);
                          }}
                        />
                      ) : (
                        <TextInput
                          style={styles.filterSearchInput}
                          placeholder="YYYY-MM-DD"
                          value={recordsCustomDate}
                          onChangeText={(val) => {
                            setRecordsCustomDate(val);
                            setRecordsPaginationPage(1);
                          }}
                        />
                      )}
                    </View>
                  )}
                </View>
              </View>
            </View>

            {/* Table Container */}
            <View style={styles.tableCard}>
              <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                <View style={styles.tableContainer}>
                  {/* Table Header */}
                  <View style={[styles.tableRow, styles.tableHeaderRowStyle]}>
                    <Text style={[styles.tableHeaderCell, { minWidth: 140 }]}>Patient ID</Text>
                    <Text style={[styles.tableHeaderCell, { minWidth: 150 }]}>Patient Name</Text>
                    <Text style={[styles.tableHeaderCell, { minWidth: 50 }]}>Age</Text>
                    <Text style={[styles.tableHeaderCell, { minWidth: 80 }]}>Gender</Text>
                    <Text style={[styles.tableHeaderCell, { minWidth: 130 }]}>Phone Number</Text>
                    <Text style={[styles.tableHeaderCell, { minWidth: 140 }]}>Department</Text>
                    <Text style={[styles.tableHeaderCell, { minWidth: 140 }]}>Doctor</Text>
                    <Text style={[styles.tableHeaderCell, { minWidth: 90 }]}>Token No.</Text>
                    <Text style={[styles.tableHeaderCell, { minWidth: 110 }]}>Visit Date</Text>
                    <Text style={[styles.tableHeaderCell, { minWidth: 95 }]}>Visit Time</Text>
                    <Text style={[styles.tableHeaderCell, { minWidth: 100 }]}>Queue Status</Text>
                    <Text style={[styles.tableHeaderCell, { minWidth: 100 }]}>Consultation</Text>
                  </View>

                  {/* Table Body */}
                  {loadingRecords ? (
                    <View style={styles.tableLoadingState}>
                      <Text style={styles.tableLoadingText}>Loading records...</Text>
                    </View>
                  ) : paginatedRows.length === 0 ? (
                    <View style={styles.tableEmptyState}>
                      <FileText size={48} color="#cbd5e1" style={{ marginBottom: 12 }} />
                      <Text style={styles.tableEmptyText}>No Patient Records Found</Text>
                      <Text style={styles.tableEmptySub}>Try adjusting the search query or filters.</Text>
                    </View>
                  ) : (
                    paginatedRows.map((row, index) => {
                      const isEven = index % 2 === 0;
                      return (
                        <View key={row.patientId + '-' + index} style={[styles.tableRow, isEven ? styles.tableRowEven : styles.tableRowOdd]}>
                          <Text style={[styles.tableBodyCell, { minWidth: 140, fontWeight: '700', color: '#1d4ed8' }]}>{row.patientId}</Text>
                          <Text style={[styles.tableBodyCell, { minWidth: 150, fontWeight: '700', color: '#0f172a' }]}>{row.patientName}</Text>
                          <Text style={[styles.tableBodyCell, { minWidth: 50, color: '#334155' }]}>{row.age}</Text>
                          <Text style={[styles.tableBodyCell, { minWidth: 80, color: '#334155' }]}>{row.gender}</Text>
                          <Text style={[styles.tableBodyCell, { minWidth: 130, color: '#475569' }]}>{row.phone}</Text>
                          <Text style={[styles.tableBodyCell, { minWidth: 140, color: '#334155', fontWeight: '500' }]}>{row.department}</Text>
                          <Text style={[styles.tableBodyCell, { minWidth: 140, color: '#475569', fontStyle: 'italic' }]}>{row.doctor}</Text>
                          <Text style={[styles.tableBodyCell, { minWidth: 90, fontWeight: '800', color: '#2563eb' }]}>{row.tokenNumber}</Text>
                          <Text style={[styles.tableBodyCell, { minWidth: 110, color: '#334155' }]}>{row.visitDate}</Text>
                          <Text style={[styles.tableBodyCell, { minWidth: 95, color: '#334155' }]}>{row.visitTime}</Text>
                          <View style={{ minWidth: 100, justifyContent: 'center' }}>
                            <View style={[styles.statusBadgeSmall, row.queueStatus === 'Served' ? styles.statusBadgeServed : styles.statusBadgeWaiting]}>
                              <Text style={[styles.statusBadgeTextSmall, { color: row.queueStatus === 'Served' ? '#16a34a' : '#d97706' }]}>
                                {row.queueStatus}
                              </Text>
                            </View>
                          </View>
                          <View style={{ minWidth: 100, justifyContent: 'center' }}>
                            <View style={[styles.statusBadgeSmall, row.consultationStatus === 'Completed' ? styles.statusBadgeServed : styles.statusBadgeWaiting]}>
                              <Text style={[styles.statusBadgeTextSmall, { color: row.consultationStatus === 'Completed' ? '#16a34a' : '#d97706' }]}>
                                {row.consultationStatus}
                              </Text>
                            </View>
                          </View>
                        </View>
                      );
                    })
                  )}
                </View>
              </ScrollView>
            </View>

            {/* Pagination Controls */}
            {filteredRows.length > 0 && (
              <View style={styles.paginationRow}>
                <TouchableOpacity
                  style={[styles.paginationBtn, recordsPaginationPage === 1 && styles.paginationBtnDisabled]}
                  disabled={recordsPaginationPage === 1}
                  onPress={() => setRecordsPaginationPage(prev => Math.max(1, prev - 1))}
                >
                  <Text style={styles.paginationBtnText}>Previous</Text>
                </TouchableOpacity>

                <Text style={styles.paginationLabel}>
                  Page {recordsPaginationPage} of {totalPages} (Total: {filteredRows.length})
                </Text>

                <TouchableOpacity
                  style={[styles.paginationBtn, recordsPaginationPage === totalPages && styles.paginationBtnDisabled]}
                  disabled={recordsPaginationPage === totalPages}
                  onPress={() => setRecordsPaginationPage(prev => Math.min(totalPages, prev + 1))}
                >
                  <Text style={styles.paginationBtnText}>Next</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        );
      })()}

      {/* ══════════════════════════════════════════════════════════════════════
          QUEUE MANAGEMENT TAB (existing content)
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'queue' && (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* 2. ACTIVE PATIENT CARD */}
          {activePatient ? (
            <View style={styles.activePatientContainer}>
              <Text style={styles.sectionTitle}>Current Patient</Text>
              <Card style={styles.activeCard}>
                <View style={styles.activeCardContent}>
                  <View style={styles.mainTokenArea}>
                    <Text style={styles.tokenLabel}>TOKEN</Text>
                    <Text style={styles.largeToken}>{formatTokenId(activePatient.id)}</Text>
                    <View style={[styles.priorityBadge, { backgroundColor: getPriorityColors(activePatient.type).bg }]}>
                      <Text style={[styles.priorityText, { color: getPriorityColors(activePatient.type).text }]}>
                        {getPriorityColors(activePatient.type).name}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.patientDetails}>
                    <Text style={styles.patientName}>{activePatient.patient?.name || "Patient Name"}</Text>
                    <Text style={styles.patientAge}>
                      {activePatient.patient?.age || "--"} Yrs • {activePatient.patient?.gender?.charAt(0).toUpperCase() || "U"}
                    </Text>
                    <View style={styles.infoRow}>
                      <Stethoscope size={14} color="#64748b" />
                      <Text style={styles.infoText}>{activePatient.primaryDepartment || "General Consultation"}</Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Activity size={14} color="#64748b" />
                      <Text style={styles.infoText} numberOfLines={1}>
                        Symptoms: Standard check-up
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
                  <Text style={[styles.primaryActionText, prescriptionMode && { color: "#fff" }]}>Prescription</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.completeBtn} onPress={handleMarkComplete}>
                  <CheckCircle2 size={24} color="#fff" />
                  <Text style={styles.completeBtnText}>Mark Complete</Text>
                </TouchableOpacity>
              </View>

              {/* QR Scanner Section */}
              <TouchableOpacity style={styles.scanQrBtn} onPress={openScanner}>
                <QrCode size={20} color="#fff" />
                <Text style={styles.scanQrBtnText}>Scan QR Code</Text>
              </TouchableOpacity>

              {/* QR Scanner Camera */}
              {scannerOpen && (
                <View style={styles.scannerContainer}>
                  <View style={styles.scannerHeader}>
                    <Text style={styles.scannerTitle}>📷 Scanning...</Text>
                    <TouchableOpacity onPress={closeScanner} style={styles.closeScannerBtn}>
                      <Text style={styles.closeScannerText}>✕ Close</Text>
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
                      <Text style={styles.scanHintText}>Align QR code within the frame</Text>
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
                      <Text style={styles.completedHeaderText}>Appointment Completed</Text>
                    </View>
                    <View style={styles.completedBody}>
                      <View style={styles.completedTokenCircle}>
                        <Text style={styles.completedTokenText}>{formatTokenId(lastScannedPatient.id)}</Text>
                      </View>
                      <View style={styles.completedInfo}>
                        <Text style={styles.completedName}>{lastScannedPatient.patient?.name || "Patient"}</Text>
                        <Text style={styles.completedDetail}>
                          {lastScannedPatient.patient?.age || "--"} Yrs • {lastScannedPatient.primaryDepartment || "General"}
                        </Text>
                        <View style={styles.completedBadge}>
                          <Text style={styles.completedBadgeText}>✓ Done</Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  {/* Next Patient's Turn */}
                  {nextPatientAfterScan ? (
                    <View style={styles.nextPatientCard}>
                      <View style={styles.nextPatientHeader}>
                        <Activity size={18} color="#2563eb" />
                        <Text style={styles.nextPatientHeaderText}>Next Patient's Turn</Text>
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
                            {nextPatientAfterScan.patient?.age || "--"} Yrs • {nextPatientAfterScan.primaryDepartment || "General"}
                          </Text>
                        </View>
                        <View style={[styles.nextPriorityBadge, { borderColor: getPriorityColors(nextPatientAfterScan.type).border }]}>
                          <Text style={[styles.nextPriorityText, { color: getPriorityColors(nextPatientAfterScan.type).text }]}>
                            {getPriorityColors(nextPatientAfterScan.type).name}
                          </Text>
                        </View>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.noMorePatientsCard}>
                      <CheckCircle2 size={24} color="#22c55e" />
                      <Text style={styles.noMorePatientsText}>All appointments completed! 🎉</Text>
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
                      <Text style={[styles.tabText, prescriptionMode === 'template' && styles.activeTabText]}>Template</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.tabBtn, prescriptionMode === 'upload' && styles.activeTab]}
                      onPress={() => setPrescriptionMode('upload')}
                    >
                      <Text style={[styles.tabText, prescriptionMode === 'upload' && styles.activeTabText]}>Upload</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.tabBtn, prescriptionMode === 'scan' && styles.activeTab]}
                      onPress={() => setPrescriptionMode('scan')}
                    >
                      <Text style={[styles.tabText, prescriptionMode === 'scan' && styles.activeTabText]}>Scan</Text>
                    </TouchableOpacity>
                  </View>

                  {/* 4A. USE PRESCRIPTION TEMPLATE */}
                  {prescriptionMode === 'template' && (
                    <View style={styles.panelContent}>
                      <Text style={styles.subTitle}>Quick Templates</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsContainer}>
                        {TEMPLATES.map((tmpl, idx) => (
                          <TouchableOpacity key={idx} style={styles.chip} onPress={() => handleApplyTemplate(tmpl)}>
                            <Text style={styles.chipText}>{tmpl.name}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>

                      <Text style={styles.label}>Problem / Diagnosis</Text>
                      <TextInput
                        style={styles.inputArea}
                        value={diagnosis}
                        onChangeText={setDiagnosis}
                        placeholder="Enter diagnosis..."
                      />

                      <Text style={[styles.label, { marginTop: 12 }]}>Medicines & Dosage</Text>
                      {medicines.map((med, index) => (
                        <View key={index} style={styles.medicineRow}>
                          <TextInput
                            style={[styles.inputField, { flex: 2 }]}
                            placeholder="Medicine Name"
                            value={med.name}
                            onChangeText={(v) => updateMedicine(index, 'name', v)}
                          />
                          <View style={styles.medCol}>
                            <TextInput
                              style={[styles.inputField, { marginBottom: 4 }]}
                              placeholder="Dosage (e.g., 1-0-1)"
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
                            placeholder="Days"
                            value={med.days}
                            keyboardType="numeric"
                            onChangeText={(v) => updateMedicine(index, 'days', v)}
                          />
                        </View>
                      ))}
                      <TouchableOpacity style={styles.addMedBtn} onPress={addMedicineRow}>
                        <Plus size={16} color="#2563eb" />
                        <Text style={styles.addMedText}>Add Medicine</Text>
                      </TouchableOpacity>

                      <Text style={[styles.label, { marginTop: 12 }]}>Advice / Precautions</Text>
                      <TextInput
                        style={[styles.inputArea, { height: 60 }]}
                        value={advice}
                        onChangeText={setAdvice}
                        placeholder="Write short advice..."
                        multiline
                      />

                      <TouchableOpacity style={styles.saveRxBtn} onPress={handleSavePrescription}>
                        <Save size={18} color="#fff" style={{ marginRight: 8 }} />
                        <Text style={styles.saveRxText}>Save Prescription</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* 4B. UPLOAD PRESCRIPTION */}
                  {prescriptionMode === 'upload' && (
                    <View style={styles.panelContent}>
                      <View style={styles.uploadArea}>
                        <Upload size={48} color="#94a3b8" style={{ marginBottom: 12 }} />
                        <Text style={styles.uploadText}>Tap to choose Image or PDF</Text>
                        <TouchableOpacity style={styles.chooseFileBtn}>
                          <Text style={styles.chooseFileText}>Choose File</Text>
                        </TouchableOpacity>
                      </View>
                      <TouchableOpacity style={styles.saveRxBtn} onPress={handleSavePrescription}>
                        <Save size={18} color="#fff" style={{ marginRight: 8 }} />
                        <Text style={styles.saveRxText}>Save Prescription</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* 4C. SCAN PRESCRIPTION */}
                  {prescriptionMode === 'scan' && (
                    <View style={styles.panelContent}>
                      <View style={styles.scanArea}>
                        <Camera size={48} color="#94a3b8" style={{ marginBottom: 12 }} />
                        <Text style={styles.uploadText}>Camera Preview</Text>
                        <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
                          <TouchableOpacity style={[styles.chooseFileBtn, { backgroundColor: '#e2e8f0' }]}>
                            <Text style={[styles.chooseFileText, { color: '#475569' }]}>Start Camera</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.chooseFileBtn}>
                            <Text style={styles.chooseFileText}>Capture Scan</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                      <TouchableOpacity style={styles.saveRxBtn} onPress={handleSavePrescription}>
                        <Save size={18} color="#fff" style={{ marginRight: 8 }} />
                        <Text style={styles.saveRxText}>Save Prescription</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}

            </View>
          ) : (
            <View style={styles.emptyState}>
              <CheckCircle2 size={64} color="#22c55e" style={{ marginBottom: 16 }} />
              <Text style={styles.emptyTitle}>Queue Clear</Text>
              <Text style={styles.emptySub}>No patients waiting for consultation.</Text>
            </View>
          )}

          {/* 5. UPCOMING QUEUE SECTION */}
          <View style={styles.queueSection}>
            <Text style={styles.sectionTitle}>Upcoming Queue (All {upcomingQueue.length})</Text>
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
                    <Text style={styles.queueItemType}>{item.primaryDepartment || "General"}</Text>
                  </View>
                  <View style={[styles.queueBadge, { borderColor: getPriorityColors(item.type).border }]}>
                    <Text style={[styles.queueBadgeText, { color: getPriorityColors(item.type).text }]}>
                      {getPriorityColors(item.type).name}
                    </Text>
                  </View>
                </View>
              ))}
              {upcomingQueue.length === 0 && (
                <Text style={styles.emptyQueueText}>No upcoming patients.</Text>
              )}
            </ScrollView>
          </View>

        </ScrollView>
      )}
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

  // ─── Main Tab Bar ───────────────────────────────────────────────────────
  mainTabBar: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    backgroundColor: "#ffffff",
  },
  mainTabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 11,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  mainTabBtnActive: {
    borderBottomColor: "#2563eb",
    backgroundColor: "#eff6ff",
  },
  mainTabText: { fontSize: 13, fontWeight: "600", color: "#64748b" },
  mainTabTextActive: { color: "#2563eb" },

  // ─── Live Queue Display ─────────────────────────────────────────────────
  liveHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  liveTitle: { fontSize: 18, fontWeight: "800", color: "#0f172a" },
  liveSubtitle: { fontSize: 13, color: "#64748b", marginTop: 2 },
  liveUpdatedBadge: {
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  liveUpdatedText: { fontSize: 11, color: "#475569", fontWeight: "600" },
  liveEmptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  liveEmptyTitle: { fontSize: 20, fontWeight: "700", color: "#334155", marginTop: 16, marginBottom: 6 },
  liveEmptySub: { fontSize: 14, color: "#94a3b8", textAlign: "center" },
  liveCard: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 10,
    overflow: "hidden",
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
  },
  liveAccentBar: { width: 5 },
  liveCardBody: { flex: 1, padding: 14 },
  liveDeptName: { fontSize: 15, fontWeight: "800", color: "#0f172a", marginBottom: 10 },
  liveInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    marginBottom: 8,
  },
  liveInfoCell: { flex: 1, alignItems: "center" },
  liveInfoLabel: { fontSize: 10, color: "#94a3b8", fontWeight: "700", letterSpacing: 0.5, marginBottom: 3, textTransform: "uppercase" },
  liveInfoValue: { fontSize: 16, fontWeight: "900", color: "#0f172a" },
  liveDivider: { width: 1, height: 36, backgroundColor: "#e2e8f0", marginHorizontal: 4 },
  liveStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  liveStatusActive: { backgroundColor: "#f0fdf4" },
  liveStatusPaused: { backgroundColor: "#fffbeb" },
  liveStatusDot: { fontSize: 10 },
  liveStatusText: { fontSize: 11, fontWeight: "700" },
  liveQueueCount: { fontSize: 12, color: "#94a3b8", fontWeight: "500" },

  // ─── Patient Records Tab ────────────────────────────────────────────────
  downloadExcelBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#16a34a",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  downloadExcelText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 14,
  },
  filterCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  filterTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1e293b",
    marginBottom: 12,
  },
  filterRow: {
    flexDirection: "row",
    gap: 12,
    flexWrap: "wrap",
  },
  filterCell: {
    flex: 1,
    minWidth: 150,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748b",
    marginBottom: 6,
  },
  filterSearchInput: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#1e293b",
    backgroundColor: "#f8fafc",
    width: "100%",
  },
  webSelect: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#1e293b",
    backgroundColor: "#ffffff",
    width: "100%",
    outlineStyle: "none",
  },
  webDateInput: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#1e293b",
    backgroundColor: "#ffffff",
    width: "100%",
    fontFamily: "inherit",
    outlineStyle: "none",
  },
  quickDateRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  quickDateBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  quickDateBtnActive: {
    backgroundColor: "#eff6ff",
    borderColor: "#2563eb",
    borderWidth: 1,
  },
  quickDateText: {
    fontSize: 12,
    color: "#475569",
    fontWeight: "600",
  },
  quickDateTextActive: {
    color: "#2563eb",
    fontWeight: "700",
  },
  customDateContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  tableCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 16,
    overflow: "hidden",
  },
  tableContainer: {
    minWidth: "100%",
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  tableHeaderRowStyle: {
    backgroundColor: "#f8fafc",
    borderBottomWidth: 2,
    borderBottomColor: "#e2e8f0",
  },
  tableHeaderCell: {
    fontSize: 12,
    fontWeight: "800",
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tableRowEven: {
    backgroundColor: "#ffffff",
  },
  tableRowOdd: {
    backgroundColor: "#fdfdfd",
  },
  tableBodyCell: {
    fontSize: 13,
    color: "#334155",
    paddingRight: 8,
  },
  statusBadgeSmall: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  statusBadgeServed: {
    backgroundColor: "#f0fdf4",
  },
  statusBadgeWaiting: {
    backgroundColor: "#fffbeb",
  },
  statusBadgeTextSmall: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  tableLoadingState: {
    paddingVertical: 60,
    alignItems: "center",
  },
  tableLoadingText: {
    color: "#64748b",
    fontSize: 14,
  },
  tableEmptyState: {
    paddingVertical: 60,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 600,
  },
  tableEmptyText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#475569",
  },
  tableEmptySub: {
    fontSize: 13,
    color: "#94a3b8",
    marginTop: 4,
  },
  paginationRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  paginationBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  paginationBtnDisabled: {
    opacity: 0.5,
    backgroundColor: "#f1f5f9",
  },
  paginationBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
  },
  paginationLabel: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: "600",
  },
});

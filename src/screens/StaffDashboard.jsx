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
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAppContext } from "../context/AppContext";
import { supabase } from "../services/supabaseClient";
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
  Volume2
} from "lucide-react-native";
import { Card } from "../components/ui/card";
import { toast } from "sonner-native";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../components/ui/select";

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
  
  // Sort queue by priority
  const priorityMap = { emergency: 1, disabled: 2, common: 3 };
  
  const currentStaffDept = appState.staffInfo?.department || 'General Medicine';
  const matchedDept = (appState.departments || []).find(d => d.name === currentStaffDept);
  const staffDeptId = matchedDept ? matchedDept.id : 'gen_med';

  // All active tokens
  const allActiveTokens = (appState.tokens || []).filter(t => {
    // Find active visit for this department
    const v = (t.visits || []).find(visit => visit.department_id === staffDeptId && (visit.status === 'waiting' || visit.status === 'called' || visit.status === 'in_consultation'));
    return v !== undefined;
  }).sort((a, b) => {
    const pA = priorityMap[a.type] || 3;
    const pB = priorityMap[b.type] || 3;
    if (pA !== pB) return pA - pB;
    return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
  });

  const [activePatient, setActivePatient] = useState(allActiveTokens.length > 0 ? allActiveTokens[0] : null);
  
  // Upcoming queue is the next 3 patients excluding active
  const upcomingQueue = allActiveTokens.filter(t => t.id !== activePatient?.id).slice(0, 3);
  const totalWaiting = allActiveTokens.length;

  // Track prescription mode
  const [prescriptionMode, setPrescriptionMode] = useState(null); // 'template', 'upload', 'scan'

  // Template Form State
  const [diagnosis, setDiagnosis] = useState("");
  const [medicines, setMedicines] = useState([]);
  const [advice, setAdvice] = useState("");
  const [referralDeptId, setReferralDeptId] = useState("");

  // Receptionist States
  const [searchPhone, setSearchPhone] = useState("");
  const [receptionPatient, setReceptionPatient] = useState({
    name: "",
    phone: "",
    age: "",
    gender: "unspecified",
    type: "common",
    primaryDepartment: "General Medicine",
    assignedDoctor: ""
  });
  const [generatedKioskToken, setGeneratedKioskToken] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [receptionLoading, setReceptionLoading] = useState(false);
  const receptionBookingInProgress = useRef(false);

  // Processing state for action button protection
  const [isProcessing, setIsProcessing] = useState(false);

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

  const handleSavePrescription = () => {
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
    
    toast.success("Prescription Saved", {
      description: "Available in patient records.",
    });

    // Reset panel
    setPrescriptionMode(null);
    setDiagnosis("");
    setMedicines([]);
    setAdvice("");
  };

  // Receptionist Handlers
  const handleSearchPatient = async () => {
    if (!searchPhone.trim()) {
      toast.error("Please enter a phone number to search");
      return;
    }
    setIsSearching(true);
    try {
      const { data, error } = await supabase
        .from('queue')
        .select('*')
        .eq('patient_phone', searchPhone)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      if (data && data.length > 0) {
        const match = data[0];
        setReceptionPatient(prev => ({
          ...prev,
          name: match.patient_name || "",
          phone: match.patient_phone || searchPhone,
          age: match.patient_age ? String(match.patient_age) : "",
          gender: match.patient_gender || "unspecified"
        }));
        toast.success("Patient found!", { description: `Loaded details for ${match.patient_name}.` });
      } else {
        toast.error("No record found. Please enter details manually.");
        setReceptionPatient(prev => ({
          ...prev,
          phone: searchPhone,
          name: "",
          age: "",
          gender: "unspecified"
        }));
      }
    } catch (err) {
      console.error(err);
      toast.error("Search failed");
    } finally {
      setIsSearching(false);
    }
  };

  const handleReceptionGenerateToken = async () => {
    if (receptionBookingInProgress.current || receptionLoading) return;
    if (!receptionPatient.name.trim()) {
      toast.error("Patient Name is required");
      return;
    }
    if (!receptionPatient.phone.trim()) {
      toast.error("Phone Number is required");
      return;
    }

    receptionBookingInProgress.current = true;
    setReceptionLoading(true);
    const now = new Date();
    const scheduledTime = now;
    
    // Calculate incremental token number locally
    const typeTokens = appState.tokens.filter(t => t.type === receptionPatient.type);
    const tokenNumber = String(typeTokens.length + 1).padStart(3, '0');
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
    
    const prefix = receptionPatient.type === 'emergency' ? 'EME' : receptionPatient.type === 'disabled' ? 'ACE' : 'GEN';
    const tokenId = `${prefix}-${timeStr}-${tokenNumber}`;
    const patientId = `PAT-ASSISTED-${dateStr}-${tokenNumber}`;
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const deptObj = (appState.departments || []).find(d => d.name === receptionPatient.primaryDepartment) || { id: 'gen_med', name: 'General Medicine' };
    const position = appState.tokens.filter(t => t.primaryDepartment === deptObj.name && t.status === 'waiting').length + 1;
    const waitTime = position * (deptObj.average_wait_time || 15);

    const newToken = {
        id: tokenId,
        type: receptionPatient.type,
        primaryDepartment: deptObj.name,
        timestamp: now,
        scheduledTime: scheduledTime,
        patient: {
            name: receptionPatient.name,
            email: '',
            phone: receptionPatient.phone,
            age: parseInt(receptionPatient.age || '0'),
            gender: receptionPatient.gender,
            patientId: patientId
        },
        status: 'waiting',
        priority: receptionPatient.type === 'emergency' ? 1 : receptionPatient.type === 'disabled' ? 2 : 3,
        qrCode: tokenId,
        validUntil: endOfDay,
        createdAt: now,
        estimatedWaitTime: waitTime,
        positionInQueue: position,
        booking_type: 'assisted',
        visits: [],
        prescriptions: [],
        labTests: [],
        departmentAccess: [deptObj.name]
    };

    try {
        // Save to database
        const { error } = await supabase.from('queue').insert([{
            token_id: tokenId,
            patient_name: newToken.patient.name,
            department: newToken.primaryDepartment,
            status: 'waiting',
            booking_type: 'assisted',
            patient_phone: receptionPatient.phone,
            patient_age: parseInt(receptionPatient.age || '0'),
            patient_gender: receptionPatient.gender,
            doctor_id: (receptionPatient.assignedDoctor && receptionPatient.assignedDoctor !== 'any') ? receptionPatient.assignedDoctor : null,
            token_data: newToken
        }]);

        if (error) throw error;

        // Insert into queue_visits relation
        const { error: visitError } = await supabase.from('queue_visits').insert([{
            token_id: tokenId,
            department_id: deptObj.id,
            doctor_id: (receptionPatient.assignedDoctor && receptionPatient.assignedDoctor !== 'any') ? receptionPatient.assignedDoctor : null,
            status: 'waiting',
            sequence_order: 1
        }]);

        if (visitError) {
            // Cleanup queue insert to maintain consistency
            await supabase.from('queue').delete().eq('token_id', tokenId).catch(console.error);
            throw visitError;
        }

        // Update app context optimistically
        setAppState(prev => ({
            ...prev,
            tokens: [...prev.tokens, newToken]
        }));

        setGeneratedKioskToken(newToken);
        toast.success("Token Generated Successfully!");
        receptionBookingInProgress.current = false;
        setReceptionLoading(false);
    } catch (error) {
        console.error('Assisted Token Generation Failed:', {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint,
            raw: error
        });
        toast.error("Unable to generate the token. Please try again.");
        receptionBookingInProgress.current = false;
        setReceptionLoading(false);
    }
  };

  // Queue Transition Handlers
  const handleStartConsultation = async () => {
    if (!activePatient || isProcessing) return;
    setIsProcessing(true);

    try {
      const activeVisit = (activePatient.visits || []).find(v => v.department_id === staffDeptId && (v.status === 'waiting' || v.status === 'called'));
      
      if (activeVisit) {
        await supabase
          .from('queue_visits')
          .update({ status: 'in_consultation' })
          .eq('id', activeVisit.id);
      }

      const updatedTokenProps = { ...activePatient, status: "in_consultation" };
      await supabase
        .from('queue')
        .update({ status: 'in_consultation', token_data: updatedTokenProps })
        .eq('token_id', activePatient.id);

      const updatedTokens = appState.tokens.map((token) =>
        token.id === activePatient.id ? updatedTokenProps : token
      );
      setAppState((prev) => ({ ...prev, tokens: updatedTokens }));

      toast.success("Consultation Started", {
        description: `Consultation started with ${activePatient.patient?.name || "Patient"}.`,
      });
    } catch (error) {
      console.error("Start consultation failed:", error);
      toast.error("Error", { description: "Something went wrong. Please try again." });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSkipPatient = async () => {
    if (!activePatient || isProcessing) return;
    setIsProcessing(true);

    try {
      const activeVisit = (activePatient.visits || []).find(v => v.department_id === staffDeptId && (v.status === 'waiting' || v.status === 'called' || v.status === 'in_consultation'));
      
      if (activeVisit) {
        await supabase
          .from('queue_visits')
          .update({ status: 'skipped' })
          .eq('id', activeVisit.id);
      }

      const updatedTokenProps = { ...activePatient, status: "skipped" };
      await supabase
        .from('queue')
        .update({ status: 'skipped', token_data: updatedTokenProps })
        .eq('token_id', activePatient.id);

      const updatedTokens = appState.tokens.map((token) =>
        token.id === activePatient.id ? updatedTokenProps : token
      );
      setAppState((prev) => ({ ...prev, tokens: updatedTokens }));

      toast.success("Patient Skipped", {
        description: `${activePatient.patient?.name || "Patient"} has been skipped.`,
      });

      // Find next patient
      const remainingTokens = allActiveTokens.filter(t => t.id !== activePatient.id);
      setActivePatient(remainingTokens.length > 0 ? remainingTokens[0] : null);
    } catch (error) {
      console.error("Skip patient failed:", error);
      toast.error("Error", { description: "Something went wrong. Please try again." });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancelToken = async () => {
    if (!activePatient || isProcessing) return;
    setIsProcessing(true);

    try {
      const activeVisit = (activePatient.visits || []).find(v => v.department_id === staffDeptId && (v.status === 'waiting' || v.status === 'called' || v.status === 'in_consultation'));
      
      if (activeVisit) {
        await supabase
          .from('queue_visits')
          .update({ status: 'cancelled' })
          .eq('id', activeVisit.id);
      }

      const updatedTokenProps = { ...activePatient, status: "cancelled" };
      await supabase
        .from('queue')
        .update({ status: 'cancelled', token_data: updatedTokenProps })
        .eq('token_id', activePatient.id);

      const updatedTokens = appState.tokens.map((token) =>
        token.id === activePatient.id ? updatedTokenProps : token
      );
      setAppState((prev) => ({ ...prev, tokens: updatedTokens }));

      toast.success("Token Cancelled", {
        description: `Token ${activePatient.id} has been cancelled.`,
      });

      // Find next patient
      const remainingTokens = allActiveTokens.filter(t => t.id !== activePatient.id);
      setActivePatient(remainingTokens.length > 0 ? remainingTokens[0] : null);
    } catch (error) {
      console.error("Cancel token failed:", error);
      toast.error("Error", { description: "Something went wrong. Please try again." });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCallPatient = async () => {
    if (!activePatient || isProcessing) return;
    setIsProcessing(true);
    
    const roomCounter = appState.staffInfo?.room_counter || 'Room 101';

    try {
      // 1. Find active visit in queue_visits for this doctor's clinic
      const activeVisit = (activePatient.visits || []).find(v => v.department_id === staffDeptId && (v.status === 'waiting' || v.status === 'called'));
      
      if (activeVisit) {
        // Update visit status and room counter
        await supabase
          .from('queue_visits')
          .update({ 
            status: 'called', 
            called_at: new Date().toISOString(),
            room_counter: roomCounter 
          })
          .eq('id', activeVisit.id);
      }

      // Update main queue token status and room counter
      const updatedTokenProps = { ...activePatient, status: "called", room_counter: roomCounter };
      await supabase
        .from('queue')
        .update({ 
            status: 'called', 
            room_counter: roomCounter,
            token_data: updatedTokenProps 
        })
        .eq('token_id', activePatient.id);

      // 2. Local State update
      const updatedTokens = appState.tokens.map((token) =>
        token.id === activePatient.id ? updatedTokenProps : token
      );
      setAppState((prev) => ({ ...prev, tokens: updatedTokens }));

      toast.success("Called Patient", {
        description: `${activePatient.patient?.name || "Patient"} requested at ${roomCounter}.`,
      });

      // 3. TTS Announcement
      const language = appState.language || 'en';
      const tokenIdClean = activePatient.id.split('-').pop() || activePatient.id;
      
      let text = `Token number ${tokenIdClean}, please proceed to ${roomCounter}`;
      if (language === 'hi') {
          text = `टोकेन नंबर ${tokenIdClean}, कृपया ${roomCounter} पर जाएं`;
      } else if (language === 'te') {
          text = `టోకెన్ నంబర్ ${tokenIdClean}, దయచేసి ${roomCounter} కి వెళ్ళండి`;
      }
      
      if (Platform.OS === 'web') {
          if ('speechSynthesis' in window) {
              window.speechSynthesis.cancel();
              const utterance = new SpeechSynthesisUtterance(text);
              utterance.lang = language === 'hi' ? 'hi-IN' : language === 'te' ? 'te-IN' : 'en-US';
              window.speechSynthesis.speak(utterance);
          }
      } else {
          try {
              const Speech = require('expo-speech');
              Speech.stop();
              Speech.speak(text, { 
                  language: language === 'hi' ? 'hi-IN' : language === 'te' ? 'te-IN' : 'en-US' 
              });
          } catch (speechErr) {
              console.error("Native TTS call failed:", speechErr);
          }
      }
    } catch (error) {
      console.error("Call handling failed:", error);
      toast.error("Error", { description: "Something went wrong. Please try again." });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMarkComplete = async () => {
    if (!activePatient || isProcessing) return;
    setIsProcessing(true);

    try {
      // 1. Find active visit in queue_visits for this doctor's clinic
      const activeVisit = (activePatient.visits || []).find(v => v.department_id === staffDeptId && (v.status === 'waiting' || v.status === 'called'));
      
      if (activeVisit) {
        // Mark current visit as completed
        await supabase
          .from('queue_visits')
          .update({ 
            status: 'completed', 
            completed_at: new Date().toISOString() 
          })
          .eq('id', activeVisit.id);
      }

      let updatedTokenProps = { ...activePatient };

      if (referralDeptId) {
        // 2. We are referring the patient!
        const targetDept = (appState.departments || []).find(d => d.id === referralDeptId);
        const targetDeptName = targetDept ? targetDept.name : 'Referred Department';
        
        // Find next sequence order
        const maxSeq = (activePatient.visits || []).reduce((max, v) => Math.max(max, v.sequence_order || 0), 0);
        const nextSeq = maxSeq + 1;

        // Check if duplicate visit exists
        const hasActiveReferredVisit = (activePatient.visits || []).some(v => v.department_id === referralDeptId && (v.status === 'waiting' || v.status === 'called'));

        if (!hasActiveReferredVisit) {
          await supabase
            .from('queue_visits')
            .insert([{
              token_id: activePatient.id,
              department_id: referralDeptId,
              doctor_id: null,
              status: 'waiting',
              sequence_order: nextSeq
            }]);
        }

        updatedTokenProps.status = "waiting";
        updatedTokenProps.room_counter = null;
        updatedTokenProps.doctor_id = null;

        await supabase
          .from('queue')
          .update({ 
            status: 'waiting', 
            room_counter: null,
            doctor_id: null,
            token_data: updatedTokenProps 
          })
          .eq('token_id', activePatient.id);

        toast.success("Patient Referred", {
          description: `Successfully referred to ${targetDeptName}.`,
        });
      } else {
        // 3. Simple completion
        updatedTokenProps.status = "completed";
        
        await supabase
          .from('queue')
          .update({ 
            status: 'completed', 
            token_data: updatedTokenProps 
          })
          .eq('token_id', activePatient.id);

        toast.success("Consultation Completed", {
          description: `${activePatient.patient?.name || "Patient"}'s session is closed.`,
        });
      }

      const updatedTokens = appState.tokens.map((token) =>
        token.id === activePatient.id ? updatedTokenProps : token
      );
      setAppState((prev) => ({ ...prev, tokens: updatedTokens }));

      // Reset states
      setPrescriptionMode(null);
      setReferralDeptId("");
      setDiagnosis("");
      setMedicines([]);
      setAdvice("");
      
      // Find next patient
      const remainingTokens = allActiveTokens.filter(t => t.id !== activePatient.id);
      setActivePatient(remainingTokens.length > 0 ? remainingTokens[0] : null);
    } catch (error) {
      console.error("Complete handling failed:", error);
      toast.error("Error", { description: "Something went wrong. Please try again." });
    } finally {
      setIsProcessing(false);
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

  const handleBarCodeScanned = ({ data }) => {
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

    // Mark token as completed
    const updatedTokenProps = { ...matchedToken, status: "completed" };
    const updatedTokens = appState.tokens.map((token) =>
      token.id === matchedToken.id ? updatedTokenProps : token
    );
    
    // Do not await, fire and forget for snappy UI
    supabase.from('queue').update({ status: 'completed', token_data: updatedTokenProps }).eq('token_id', matchedToken.id).catch(console.error);

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

  const isReceptionist = appState.staffInfo?.department === 'Receptionist' || appState.staffInfo?.role === 'receptionist';

  if (isReceptionist) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
              <ArrowLeft size={24} color="#1e293b" />
            </TouchableOpacity>
            <View style={styles.headerInfo}>
              <Text style={styles.dashboardTitle}>Assisted Registration</Text>
              <Text style={styles.doctorName}>Reception / Helpdesk Desk</Text>
            </View>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {generatedKioskToken ? (
            <Card style={{ padding: 24, borderRadius: 16, backgroundColor: '#f0fdf4', borderColor: '#bbf7d0', borderWidth: 2, alignItems: 'center' }}>
              <CheckCircle2 size={64} color="#16a34a" style={{ marginBottom: 16 }} />
              <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#16a34a', marginBottom: 8 }}>TOKEN GENERATED</Text>
              
              <View style={{ backgroundColor: '#fff', padding: 20, borderRadius: 12, width: '100%', alignItems: 'center', marginVertical: 16, borderWidth: 1, borderColor: '#cbd5e1' }}>
                <Text style={{ fontSize: 13, color: '#64748b', fontWeight: 'bold' }}>PATIENT NAME</Text>
                <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#0f172a', marginBottom: 12 }}>{generatedKioskToken.patient.name}</Text>
                
                <Text style={{ fontSize: 13, color: '#64748b', fontWeight: 'bold' }}>TOKEN ID</Text>
                <Text style={{ fontSize: 36, fontWeight: '900', color: '#2563eb', letterSpacing: 1 }}>{generatedKioskToken.id}</Text>
                
                <Text style={{ fontSize: 13, color: '#64748b', fontWeight: 'bold', marginTop: 12 }}>CLINIC / DEPT</Text>
                <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#0f172a' }}>{generatedKioskToken.primaryDepartment}</Text>
              </View>

              <TouchableOpacity 
                style={{ backgroundColor: '#2563eb', paddingVertical: 14, paddingHorizontal: 32, borderRadius: 8, marginTop: 8 }}
                onPress={() => setGeneratedKioskToken(null)}
              >
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>Register Next Patient</Text>
              </TouchableOpacity>
            </Card>
          ) : (
            <View style={{ gap: 16 }}>
              {/* Search Section */}
              <Card style={{ padding: 16, borderRadius: 12 }}>
                <Text style={{ fontSize: 15, fontWeight: 'bold', color: '#1e293b', marginBottom: 8 }}>Search Existing Patient</Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TextInput
                    style={{ flex: 1, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, backgroundColor: '#fff', color: '#1e293b' }}
                    placeholder="Enter phone number"
                    value={searchPhone}
                    onChangeText={setSearchPhone}
                    keyboardType="phone-pad"
                  />
                  <TouchableOpacity 
                    style={{ backgroundColor: '#0ea5e9', justifyContent: 'center', paddingHorizontal: 20, borderRadius: 8 }}
                    onPress={handleSearchPatient}
                    disabled={isSearching}
                  >
                    <Text style={{ color: '#fff', fontWeight: 'bold' }}>{isSearching ? "Searching..." : "Search"}</Text>
                  </TouchableOpacity>
                </View>
              </Card>

              {/* Patient Form Section */}
              <Card style={{ padding: 16, borderRadius: 12, gap: 12 }}>
                <Text style={{ fontSize: 15, fontWeight: 'bold', color: '#1e293b', marginBottom: 4 }}>Basic Patient Details</Text>
                
                <View>
                  <Text style={styles.formLabel}>Full Name</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="Enter patient full name"
                    value={receptionPatient.name}
                    onChangeText={(val) => setReceptionPatient(p => ({ ...p, name: val }))}
                  />
                </View>

                <View>
                  <Text style={styles.formLabel}>Phone Number</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="Enter phone number"
                    value={receptionPatient.phone}
                    onChangeText={(val) => setReceptionPatient(p => ({ ...p, phone: val }))}
                    keyboardType="phone-pad"
                  />
                </View>

                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.formLabel}>Age (Yrs)</Text>
                    <TextInput
                      style={styles.formInput}
                      placeholder="Age"
                      value={receptionPatient.age}
                      onChangeText={(val) => setReceptionPatient(p => ({ ...p, age: val }))}
                      keyboardType="numeric"
                    />
                  </View>

                  <View style={{ flex: 1.5 }}>
                    <Text style={styles.formLabel}>Gender</Text>
                    <Select value={receptionPatient.gender} onValueChange={(val) => setReceptionPatient(p => ({ ...p, gender: val }))}>
                      <SelectTrigger style={{ height: 44, borderColor: '#cbd5e1', borderWidth: 1, borderRadius: 8, paddingHorizontal: 12 }}>
                        <SelectValue placeholder="Gender" />
                      </SelectTrigger>
                      <SelectContent style={{ backgroundColor: '#fff' }}>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                        <SelectItem value="unspecified">Unspecified</SelectItem>
                      </SelectContent>
                    </Select>
                  </View>
                </View>

                <View>
                  <Text style={styles.formLabel}>Service Type / Category</Text>
                  <Select value={receptionPatient.type} onValueChange={(val) => setReceptionPatient(p => ({ ...p, type: val }))}>
                    <SelectTrigger style={{ height: 44, borderColor: '#cbd5e1', borderWidth: 1, borderRadius: 8, paddingHorizontal: 12 }}>
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent style={{ backgroundColor: '#fff' }}>
                      <SelectItem value="common">General Booking</SelectItem>
                      <SelectItem value="emergency">Emergency Booking</SelectItem>
                      <SelectItem value="disabled">Accessibility Booking</SelectItem>
                    </SelectContent>
                  </Select>
                </View>

                <View>
                  <Text style={styles.formLabel}>Clinic / Department</Text>
                  <Select value={receptionPatient.primaryDepartment} onValueChange={(val) => setReceptionPatient(p => ({ ...p, primaryDepartment: val }))}>
                    <SelectTrigger style={{ height: 44, borderColor: '#cbd5e1', borderWidth: 1, borderRadius: 8, paddingHorizontal: 12 }}>
                      <SelectValue placeholder="Select Clinic" />
                    </SelectTrigger>
                    <SelectContent style={{ backgroundColor: '#fff' }}>
                      {(appState.departments || []).map(d => (
                        <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </View>

                <TouchableOpacity 
                  style={{ backgroundColor: '#16a34a', paddingVertical: 14, borderRadius: 8, alignItems: 'center', marginTop: 12 }}
                  onPress={handleReceptionGenerateToken}
                  disabled={receptionLoading}
                >
                  <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>
                    {receptionLoading ? "Generating Token..." : "Generate Token & Print"}
                  </Text>
                </TouchableOpacity>
              </Card>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

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
      </View>

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
                      Symptoms: {activePatient.patient?.symptoms || "None"}
                    </Text>
                  </View>
                  <View style={styles.verifyContainer}>
                    <Text style={styles.verifyText}>ID: {activePatient.id.substring(0,8).toUpperCase()}</Text>
                  </View>
                </View>
              </View>
            </Card>

            {/* Referral Dropdown (Only show in consultation) */}
            {activePatient.status === 'in_consultation' && (
              <View style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#475569', marginBottom: 6 }}>Refer Patient to Clinic / Department:</Text>
                <Select value={referralDeptId} onValueChange={setReferralDeptId}>
                  <SelectTrigger style={{ backgroundColor: '#fff', borderColor: '#cbd5e1', borderWidth: 1, borderRadius: 8, padding: 12 }}>
                    <SelectValue placeholder="Select Clinic / Department (Optional)" />
                  </SelectTrigger>
                  <SelectContent style={{ backgroundColor: '#fff' }}>
                    <SelectItem value="">None (Consultation Completed)</SelectItem>
                    {(appState.departments || []).filter(d => d.id !== staffDeptId).map(d => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </View>
            )}

            {/* 3. MAIN ACTION AREA */}
            <View style={styles.mainActionArea}>
              {activePatient.status === 'waiting' && (
                <>
                  <TouchableOpacity style={[styles.completeBtn, { backgroundColor: '#ea580c', flex: 1.5, opacity: isProcessing ? 0.6 : 1 }]} onPress={handleCallPatient} disabled={isProcessing}>
                    <Volume2 size={24} color="#fff" />
                    <Text style={styles.completeBtnText}>{isProcessing ? 'Calling...' : 'Call Patient'}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={[styles.completeBtn, { backgroundColor: '#eab308', flex: 1, opacity: isProcessing ? 0.6 : 1 }]} onPress={handleSkipPatient} disabled={isProcessing}>
                    <Text style={styles.completeBtnText}>{isProcessing ? 'Skipping...' : 'Skip'}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={[styles.completeBtn, { backgroundColor: '#dc2626', flex: 1, opacity: isProcessing ? 0.6 : 1 }]} onPress={handleCancelToken} disabled={isProcessing}>
                    <Text style={styles.completeBtnText}>{isProcessing ? 'Cancelling...' : 'Cancel'}</Text>
                  </TouchableOpacity>
                </>
              )}

              {activePatient.status === 'called' && (
                <>
                  <TouchableOpacity style={[styles.completeBtn, { backgroundColor: '#2563eb', flex: 1.5, opacity: isProcessing ? 0.6 : 1 }]} onPress={handleStartConsultation} disabled={isProcessing}>
                    <Stethoscope size={24} color="#fff" />
                    <Text style={styles.completeBtnText}>{isProcessing ? 'Starting...' : 'Start Consult'}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={[styles.completeBtn, { backgroundColor: '#eab308', flex: 1, opacity: isProcessing ? 0.6 : 1 }]} onPress={handleSkipPatient} disabled={isProcessing}>
                    <Text style={styles.completeBtnText}>{isProcessing ? 'Skipping...' : 'Skip'}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={[styles.completeBtn, { backgroundColor: '#dc2626', flex: 1, opacity: isProcessing ? 0.6 : 1 }]} onPress={handleCancelToken} disabled={isProcessing}>
                    <Text style={styles.completeBtnText}>{isProcessing ? 'Cancelling...' : 'Cancel'}</Text>
                  </TouchableOpacity>
                </>
              )}

              {activePatient.status === 'in_consultation' && (
                <>
                  <TouchableOpacity
                    style={[styles.primaryActionBtn, prescriptionMode ? styles.activeActionBtn : null]}
                    onPress={() => setPrescriptionMode(prescriptionMode ? null : 'template')}
                  >
                    <FileText size={20} color={prescriptionMode ? "#fff" : "#2563eb"} />
                    <Text style={[styles.primaryActionText, prescriptionMode && { color: "#fff" }]}>Prescription</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity style={[styles.completeBtn, { opacity: isProcessing ? 0.6 : 1 }]} onPress={handleMarkComplete} disabled={isProcessing}>
                    <CheckCircle2 size={24} color="#fff" />
                    <Text style={styles.completeBtnText}>{isProcessing ? 'Completing...' : 'Complete'}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={[styles.completeBtn, { backgroundColor: '#dc2626', flex: 0.5, opacity: isProcessing ? 0.6 : 1 }]} onPress={handleCancelToken} disabled={isProcessing}>
                    <Text style={styles.completeBtnText}>{isProcessing ? 'Cancelling...' : 'Cancel'}</Text>
                  </TouchableOpacity>
                </>
              )}
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

                    <Text style={[styles.label, {marginTop: 12}]}>Medicines & Dosage</Text>
                    {medicines.map((med, index) => (
                      <View key={index} style={styles.medicineRow}>
                        <TextInput 
                          style={[styles.inputField, {flex: 2}]} 
                          placeholder="Medicine Name" 
                          value={med.name} 
                          onChangeText={(v) => updateMedicine(index, 'name', v)}
                        />
                        <View style={styles.medCol}>
                           <TextInput 
                             style={[styles.inputField, {marginBottom: 4}]} 
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
                          style={[styles.inputField, {flex: 0.8}]} 
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

                    <Text style={[styles.label, {marginTop: 12}]}>Advice / Precautions</Text>
                    <TextInput 
                      style={[styles.inputArea, {height: 60}]} 
                      value={advice} 
                      onChangeText={setAdvice}
                      placeholder="Write short advice..."
                      multiline
                    />

                    <TouchableOpacity style={styles.saveRxBtn} onPress={handleSavePrescription}>
                      <Save size={18} color="#fff" style={{marginRight: 8}}/>
                      <Text style={styles.saveRxText}>Save Prescription</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* 4B. UPLOAD PRESCRIPTION */}
                {prescriptionMode === 'upload' && (
                  <View style={styles.panelContent}>
                    <View style={styles.uploadArea}>
                      <Upload size={48} color="#94a3b8" style={{marginBottom: 12}}/>
                      <Text style={styles.uploadText}>Tap to choose Image or PDF</Text>
                      <TouchableOpacity style={styles.chooseFileBtn}>
                        <Text style={styles.chooseFileText}>Choose File</Text>
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity style={styles.saveRxBtn} onPress={handleSavePrescription}>
                      <Save size={18} color="#fff" style={{marginRight: 8}}/>
                      <Text style={styles.saveRxText}>Save Prescription</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* 4C. SCAN PRESCRIPTION */}
                {prescriptionMode === 'scan' && (
                  <View style={styles.panelContent}>
                    <View style={styles.scanArea}>
                      <Camera size={48} color="#94a3b8" style={{marginBottom: 12}}/>
                      <Text style={styles.uploadText}>Camera Preview</Text>
                      <View style={{flexDirection: 'row', gap: 12, marginTop: 16}}>
                        <TouchableOpacity style={[styles.chooseFileBtn, {backgroundColor: '#e2e8f0'}]}>
                          <Text style={[styles.chooseFileText, {color: '#475569'}]}>Start Camera</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.chooseFileBtn}>
                          <Text style={styles.chooseFileText}>Capture Scan</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                    <TouchableOpacity style={styles.saveRxBtn} onPress={handleSavePrescription}>
                      <Save size={18} color="#fff" style={{marginRight: 8}}/>
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
            <Text style={styles.emptySub}>No patients are currently waiting in your department.</Text>
          </View>
        )}

        {/* 5. UPCOMING QUEUE SECTION */}
        <View style={styles.queueSection}>
          <Text style={styles.sectionTitle}>Upcoming Queue (Next {upcomingQueue.length})</Text>
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
  formLabel: { fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 4 },
  formInput: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, backgroundColor: '#fff', color: '#1e293b' },
});

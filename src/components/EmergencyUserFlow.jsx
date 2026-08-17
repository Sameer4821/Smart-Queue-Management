var _interopRequireWildcard = require("@babel/runtime/helpers/interopRequireWildcard");
var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault"); Object.defineProperty(exports, "__esModule", { value: true }); exports.EmergencyUserFlow = EmergencyUserFlow; var _toConsumableArray2 = _interopRequireDefault(require("@babel/runtime/helpers/toConsumableArray")); var _asyncToGenerator2 = _interopRequireDefault(require("@babel/runtime/helpers/asyncToGenerator")); var _slicedToArray2 = _interopRequireDefault(require("@babel/runtime/helpers/slicedToArray")); var _react = _interopRequireWildcard(require("react"));
var _reactNative = require("react-native");
var _AppContext = require("../context/AppContext");

var _button = require("./ui/button");
var _card = require("./ui/card");
var _input = require("./ui/input");
var _label = require("./ui/label");
var _textarea = require("./ui/textarea");
var _radioGroup = require("./ui/radio-group");
var _checkbox = require("./ui/checkbox");
var _lucideReactNative = require("lucide-react-native"); 
var _jsxRuntime = require("react/jsx-runtime");
var _useTranslation = require("../hooks/useTranslation");

var assistanceOptionKeys = {
    'Wheelchair assistance': 'emgWheelchair',
    'Sign language interpreter': 'emgSignLanguage',
    'Audio assistance': 'emgAudio',
    'Personal care attendant': 'emgPersonalCare',
    'Accessible restroom': 'emgRestroom'
};


var assistanceOptions = [
    'Wheelchair assistance',
    'Sign language interpreter',
    'Audio assistance',
    'Personal care attendant',
    'Accessible restroom'];

function EmergencyUserFlow() {
    var _useAppContext = (0, _AppContext.useAppContext)(), state = _useAppContext.state, setState = _useAppContext.setState, sendEmergencyNotification = _useAppContext.sendEmergencyNotification;
    var _useTranslation2 = (0, _useTranslation.useTranslation)(), t = _useTranslation2.t;


    var _useState = (0, _react.useState)({
        name: state.patientInfo ? state.patientInfo.name : '',
        age: '',
        gender: '',
        contactNumber: state.patientInfo ? state.patientInfo.phone : '',
        emergencyType: '',
        severity: 'critical',
        conditionDetails: '',
        arrivalMethod: '',
        estimatedArrival: '',
        hasDisability: false,
        assistanceNeeded: [],
        otherAssistance: ''
    }), _useState2 = (0, _slicedToArray2.default)(_useState, 2), formData = _useState2[0], setFormData = _useState2[1];

    var _useState3 = (0, _react.useState)(false), _useState4 = (0, _slicedToArray2.default)(_useState3, 2), isSubmitting = _useState4[0], setIsSubmitting = _useState4[1];
    var _useState5 = (0, _react.useState)(false), _useState6 = (0, _slicedToArray2.default)(_useState5, 2), isConfirmed = _useState6[0], setIsConfirmed = _useState6[1];
    var _useState7 = (0, _react.useState)(null), _useState8 = (0, _slicedToArray2.default)(_useState7, 2), submittedAlert = _useState8[0], setSubmittedAlert = _useState8[1];

    var handleBack = function handleBack() {
        setState(function (prev) { return Object.assign({}, prev, { currentView: 'patient-dashboard' }); });
    };

    var handleAssistanceChange = function handleAssistanceChange(assistance, checked) {
        setFormData(function (prev) {
            return Object.assign({},
                prev, {
                assistanceNeeded: checked ? [].concat((0, _toConsumableArray2.default)(
                    prev.assistanceNeeded), [assistance]) :
                    prev.assistanceNeeded.filter(function (a) { return a !== assistance; })
            });
        });
    };

    var handleFormSubmit = /*#__PURE__*/function () {
        var _ref = (0, _asyncToGenerator2.default)(function* () {
            if (!formData.name || !formData.emergencyType || !formData.conditionDetails || !formData.severity) {
                _reactNative.Alert.alert(t('emgMissingFields'), t('emgMissingFieldsMsg'));
                return;
            }
            if (!formData.contactNumber) {
                _reactNative.Alert.alert(t('emgMissingContact'), t('emgMissingContactMsg'));
                return;
            }
            setIsSubmitting(true);

            try {
                var now = new Date();
                var timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
                var tokenNumber = String((state.tokens.filter(function(t) { return t.type === 'emergency'; }).length) + 1).padStart(3, '0');
                var alertId = `EMG-${timeStr}-${tokenNumber}`;

                var allAssistanceNeeded = (0, _toConsumableArray2.default)(formData.assistanceNeeded);
                if (formData.otherAssistance.trim()) {
                    allAssistanceNeeded.push(`Other: ${formData.otherAssistance.trim()}`);
                }

                var alertData = {
                    alert_id: alertId,
                    patient_name: formData.name,
                    patient_age: formData.age ? parseInt(formData.age) : null,
                    patient_gender: formData.gender || null,
                    contact_number: formData.contactNumber,
                    emergency_type: formData.emergencyType,
                    severity: formData.severity,
                    condition_details: formData.conditionDetails,
                    arrival_method: formData.arrivalMethod || null,
                    estimated_arrival: formData.estimatedArrival || null,
                    assistance_needed: allAssistanceNeeded.length > 0 ? allAssistanceNeeded : [],
                    alert_status: 'new',
                    created_at: now.toISOString()
                };

                var endOfDay = new Date();
                endOfDay.setHours(23, 59, 59, 999);
                var allDepartmentNames = state.departments.map(function(d) { return d.name; });

                // Build a token object matching the structure used by CommonUserFlow
                var emergencyToken = {
                    id: alertId,
                    type: 'emergency',
                    primaryDepartment: 'Emergency',
                    timestamp: now,
                    scheduledTime: now,
                    patient: {
                        name: formData.name,
                        email: (state.patientInfo && state.patientInfo.email) || '',
                        phone: formData.contactNumber || (state.patientInfo && state.patientInfo.phone) || '',
                        age: formData.age ? parseInt(formData.age) : 0,
                        gender: formData.gender || 'not specified',
                        patientId: `PAT-${now.toISOString().slice(0,10).replace(/-/g,'')}-${tokenNumber}`,
                        symptoms: `${formData.emergencyType}: ${formData.conditionDetails}`
                    },
                    status: 'active',
                    priority: 10,
                    severity: formData.severity,
                    emergency_type: formData.emergencyType,
                    assistance_needed: allAssistanceNeeded,
                    qrCode: alertId,
                    validUntil: endOfDay,
                    createdAt: now,
                    schedulingMethod: 'emergency',
                    visits: [{
                        id: 'visit-' + Date.now(),
                        department_id: 'emergency',
                        department: 'Emergency',
                        status: 'active',
                        sequence_order: 1,
                        room_counter: null,
                        doctorName: null,
                        notes: formData.conditionDetails,
                        timestamp: now
                    }],
                    prescriptions: [],
                    labTests: [],
                    departmentAccess: allDepartmentNames
                };

                var _firebase = require("../services/firebase");

                // Insert into Firestore emergency_alerts collection (for staff dashboard)
                try {
                    yield (0, _firebase.setDoc)((0, _firebase.doc)(_firebase.db, 'emergency_alerts', alertId), alertData);
                } catch (fbErr) {
                    console.log('Firestore emergency alert insert error:', fbErr);
                }

                // Also insert into Firestore tokens collection (for queue counts + patient history)
                try {
                    yield (0, _firebase.setDoc)((0, _firebase.doc)(_firebase.db, 'tokens', alertId), Object.assign({}, emergencyToken, {
                        timestamp: now.toISOString(),
                        scheduledTime: now.toISOString(),
                        validUntil: endOfDay.toISOString(),
                        createdAt: now.toISOString(),
                        token_id: alertId,
                        patient_name: formData.name,
                        department: 'Emergency',
                        status: 'active',
                        updatedAt: now.toISOString()
                    }));
                } catch (fbErr) {
                    console.log('Firestore emergency token insert error:', fbErr);
                }

                // Also add to local state immediately for instant UI feedback
                setState(function (prev) {
                    var existing = prev.emergencyAlerts || [];
                    return Object.assign({}, prev, {
                        emergencyAlerts: [].concat((0, _toConsumableArray2.default)(existing), [alertData]),
                        emergencyCount: (prev.emergencyCount || 0) + 1,
                        tokens: [].concat((0, _toConsumableArray2.default)(prev.tokens.filter(function(t) { return t.id !== alertId; })), [emergencyToken]),
                        currentToken: emergencyToken
                    });
                });

                // Send notification to affected departments
                sendEmergencyNotification('Emergency');

                setSubmittedAlert(alertData);
                setIsConfirmed(true);
            } catch (error) {
                console.error('Emergency alert submission error:', error);
                _reactNative.Alert.alert(t('emgError'), t('emgErrorMsg'));
            } finally {
                setIsSubmitting(false);
            }
        }); return function handleFormSubmit() { return _ref.apply(this, arguments); };
    }();

    // ─── CONFIRMATION SCREEN ───
    if (isConfirmed && submittedAlert) {
        var severityColors = { critical: '#dc2626', urgent: '#ea580c', moderate: '#ca8a04' };
        var severityLabels = {
            critical: t('emgCritical').split(' - ')[0].toUpperCase(),
            urgent: t('emgUrgent').split(' - ')[0].toUpperCase(),
            moderate: t('emgModerate').split(' - ')[0].toUpperCase()
        };
        return (/*#__PURE__*/
            (0, _jsxRuntime.jsxs)(_reactNative.ScrollView, {
                contentContainerStyle: styles.confirmContainer, children: [/*#__PURE__*/
                    (0, _jsxRuntime.jsxs)(_card.Card, {
                        style: [styles.confirmCard, { borderColor: '#16a34a' }], children: [/*#__PURE__*/
                            (0, _jsxRuntime.jsxs)(_reactNative.View, {
                                style: styles.confirmIconRow, children: [/*#__PURE__*/
                                    (0, _jsxRuntime.jsx)(_reactNative.View, {
                                        style: styles.confirmIconCircle, children: /*#__PURE__*/
                                            (0, _jsxRuntime.jsx)(_lucideReactNative.CheckCircle, { size: 48, color: "#16a34a" })
                                    }),/*#__PURE__*/
                                    (0, _jsxRuntime.jsx)(_reactNative.Text, { style: styles.confirmTitle, children: t('emgAlerted') }),/*#__PURE__*/
                                    (0, _jsxRuntime.jsx)(_reactNative.Text, { style: styles.confirmSub, children: t('emgAlertedSub') })]
                            }),/*#__PURE__*/

                            (0, _jsxRuntime.jsxs)(_reactNative.View, {
                                style: styles.confirmDetails, children: [/*#__PURE__*/
                                    (0, _jsxRuntime.jsxs)(_reactNative.View, {
                                        style: styles.confirmRow, children: [/*#__PURE__*/
                                            (0, _jsxRuntime.jsx)(_reactNative.Text, { style: styles.confirmLabel, children: t('emgAlertId') }),/*#__PURE__*/
                                            (0, _jsxRuntime.jsx)(_reactNative.Text, { style: styles.confirmValue, children: submittedAlert.alert_id })]
                                    }),/*#__PURE__*/
                                    (0, _jsxRuntime.jsxs)(_reactNative.View, {
                                        style: styles.confirmRow, children: [/*#__PURE__*/
                                            (0, _jsxRuntime.jsx)(_reactNative.Text, { style: styles.confirmLabel, children: t('emgSeverity') }),/*#__PURE__*/
                                            (0, _jsxRuntime.jsx)(_reactNative.View, {
                                                style: [styles.severityBadge, { backgroundColor: severityColors[submittedAlert.severity] }], children: /*#__PURE__*/
                                                    (0, _jsxRuntime.jsx)(_reactNative.Text, { style: styles.severityBadgeText, children: severityLabels[submittedAlert.severity] })
                                            })]
                                    }),/*#__PURE__*/
                                    (0, _jsxRuntime.jsxs)(_reactNative.View, {
                                        style: styles.confirmRow, children: [/*#__PURE__*/
                                            (0, _jsxRuntime.jsx)(_reactNative.Text, { style: styles.confirmLabel, children: t('emgEmergency') }),/*#__PURE__*/
                                            (0, _jsxRuntime.jsx)(_reactNative.Text, { style: styles.confirmValue, children: submittedAlert.emergency_type })]
                                    }),/*#__PURE__*/
                                    (0, _jsxRuntime.jsxs)(_reactNative.View, {
                                        style: styles.confirmRow, children: [/*#__PURE__*/
                                            (0, _jsxRuntime.jsx)(_reactNative.Text, { style: styles.confirmLabel, children: t('emgPatient') }),/*#__PURE__*/
                                            (0, _jsxRuntime.jsx)(_reactNative.Text, { style: styles.confirmValue, children: submittedAlert.patient_name })]
                                    }),
                                    submittedAlert.arrival_method && /*#__PURE__*/
                                    (0, _jsxRuntime.jsxs)(_reactNative.View, {
                                        style: styles.confirmRow, children: [/*#__PURE__*/
                                            (0, _jsxRuntime.jsx)(_reactNative.Text, { style: styles.confirmLabel, children: t('emgArrival') }),/*#__PURE__*/
                                            (0, _jsxRuntime.jsx)(_reactNative.Text, { style: styles.confirmValue, children: submittedAlert.arrival_method === 'ambulance' ? t('emgAmbulance') : submittedAlert.arrival_method === 'own_transport' ? t('emgOwnTransport') : t('emgAlreadyHere') })]
                                    })]
                            }),/*#__PURE__*/

                            (0, _jsxRuntime.jsx)(_reactNative.View, {
                                style: styles.confirmNotice, children: /*#__PURE__*/
                                    (0, _jsxRuntime.jsx)(_reactNative.Text, { style: styles.confirmNoticeText, children: t('emgNotice') })
                            })]
                    }),/*#__PURE__*/

                    (0, _jsxRuntime.jsx)(_reactNative.View, {
                        style: { flexDirection: 'row', gap: 12, marginTop: 24, justifyContent: 'center', flexWrap: 'wrap' },
                        children: [
                            (0, _jsxRuntime.jsx)(_button.Button, {
                                onPress: function() {
                                    setState(function(prev) {
                                        return Object.assign({}, prev, { currentView: 'token' });
                                    });
                                },
                                style: { backgroundColor: '#dc2626', flex: 1, minWidth: 140, paddingHorizontal: 16 },
                                children: (0, _jsxRuntime.jsx)(_reactNative.Text, { style: { color: '#fff', fontWeight: '700', textAlign: 'center' }, children: 'View My Token' })
                            }),
                            (0, _jsxRuntime.jsx)(_button.Button, {
                                onPress: handleBack, style: { flex: 1, minWidth: 140, paddingHorizontal: 16 }, children: /*#__PURE__*/
                                    (0, _jsxRuntime.jsx)(_reactNative.Text, { style: { color: '#fff', fontWeight: '700', textAlign: 'center' }, children: t('emgReturnDashboard') })
                            })
                        ]
                    })]
            }));
    }

    if (!state.patientInfo) return null;

    // ─── EMERGENCY FORM ───
    return (/*#__PURE__*/
        (0, _jsxRuntime.jsxs)(_reactNative.ScrollView, {
            contentContainerStyle: styles.container, children: [/*#__PURE__*/

                // Header card
                (0, _jsxRuntime.jsx)(_card.Card, {
                    style: [styles.cardSpacing, { borderColor: '#fca5a5' }], children: /*#__PURE__*/
                        (0, _jsxRuntime.jsxs)(_card.CardHeader, {
                            style: styles.rowBetween, children: [/*#__PURE__*/
                                (0, _jsxRuntime.jsxs)(_reactNative.View, {
                                    style: styles.row, children: [/*#__PURE__*/
                                        (0, _jsxRuntime.jsx)(_button.Button, {
                                            variant: "ghost", size: "sm", onPress: handleBack, style: { marginRight: 8 }, children: /*#__PURE__*/
                                                (0, _jsxRuntime.jsx)(_lucideReactNative.ArrowLeft, { size: 20, color: "#dc2626" })
                                        }),/*#__PURE__*/
                                        (0, _jsxRuntime.jsxs)(_reactNative.View, {
                                            children: [/*#__PURE__*/
                                                (0, _jsxRuntime.jsx)(_card.CardTitle, { style: { color: '#dc2626' }, children: t('emgTitle') }),/*#__PURE__*/
                                                (0, _jsxRuntime.jsx)(_reactNative.Text, { style: { color: '#7f1d1d', fontSize: 13 }, children: t('emgSubtitle') })]
                                        })]
                                }),/*#__PURE__*/
                                (0, _jsxRuntime.jsx)(_lucideReactNative.AlertTriangle, { size: 28, color: "#dc2626" })]
                        })
                }),/*#__PURE__*/

                // Patient info card
                (0, _jsxRuntime.jsx)(_card.Card, {
                    style: [styles.cardSpacing, { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }], children: /*#__PURE__*/
                        (0, _jsxRuntime.jsxs)(_card.CardContent, {
                            style: { paddingTop: 16, flexDirection: 'row', alignItems: 'center' }, children: [/*#__PURE__*/
                                (0, _jsxRuntime.jsx)(_lucideReactNative.UserCheck, { size: 20, color: "#2563eb", style: { marginRight: 8 } }),/*#__PURE__*/
                                (0, _jsxRuntime.jsxs)(_reactNative.View, {
                                    children: [/*#__PURE__*/
                                        (0, _jsxRuntime.jsxs)(_reactNative.Text, { style: { fontWeight: '600', color: '#1e40af' }, children: [t('patientLbl') || "Patient: ", state.patientInfo.name] }),/*#__PURE__*/
                                        (0, _jsxRuntime.jsx)(_reactNative.Text, { style: { fontSize: 13, color: '#1d4ed8' }, children: state.patientInfo.phone })]
                                })]
                        })
                }),/*#__PURE__*/

                // Main form card
                (0, _jsxRuntime.jsxs)(_card.Card, {
                    style: styles.cardSpacing, children: [/*#__PURE__*/
                        (0, _jsxRuntime.jsx)(_card.CardHeader, {
                            children: /*#__PURE__*/
                                (0, _jsxRuntime.jsxs)(_card.CardTitle, {
                                    style: { flexDirection: 'row', alignItems: 'center' }, children: [/*#__PURE__*/
                                        (0, _jsxRuntime.jsx)(_lucideReactNative.AlertTriangle, { size: 20, color: '#dc2626', style: { marginRight: 8 } }),/*#__PURE__*/
                                        (0, _jsxRuntime.jsx)(_reactNative.Text, { children: t('emgAlertDeptTitle') })]
                                })
                        }),/*#__PURE__*/
                        (0, _jsxRuntime.jsxs)(_card.CardContent, {
                            style: { paddingTop: 0, gap: 16 }, children: [/*#__PURE__*/

                                // Emergency Type
                                (0, _jsxRuntime.jsxs)(_reactNative.View, {
                                    children: [/*#__PURE__*/
                                        (0, _jsxRuntime.jsx)(_label.Label, { children: t('emgType') }),/*#__PURE__*/
                                        (0, _jsxRuntime.jsx)(_input.Input, {
                                            value: formData.emergencyType,
                                            onChangeText: function onChangeText(val) { return setFormData(Object.assign({}, formData, { emergencyType: val })); },
                                            placeholder: "e.g. Chest pain, Accident, Breathing difficulty"
                                        })]
                                }),/*#__PURE__*/


                                // Severity
                                (0, _jsxRuntime.jsxs)(_reactNative.View, {
                                    children: [/*#__PURE__*/
                                        (0, _jsxRuntime.jsx)(_label.Label, { children: t('emgSeverity') + ' *' }),/*#__PURE__*/
                                        (0, _jsxRuntime.jsxs)(_radioGroup.RadioGroup, {
                                            value: formData.severity,
                                            onValueChange: function onValueChange(val) { return setFormData(Object.assign({}, formData, { severity: val })); },
                                            style: { marginTop: 8 }, children: [/*#__PURE__*/
                                                (0, _jsxRuntime.jsx)(_radioGroup.RadioGroupItem, { value: "critical", id: "critical", label: t('emgCritical') }),/*#__PURE__*/
                                                (0, _jsxRuntime.jsx)(_radioGroup.RadioGroupItem, { value: "urgent", id: "urgent", label: t('emgUrgent') }),/*#__PURE__*/
                                                (0, _jsxRuntime.jsx)(_radioGroup.RadioGroupItem, { value: "moderate", id: "moderate", label: t('emgModerate') })]
                                        })]
                                }),/*#__PURE__*/

                                // Patient Name
                                (0, _jsxRuntime.jsxs)(_reactNative.View, {
                                    children: [/*#__PURE__*/
                                        (0, _jsxRuntime.jsx)(_label.Label, { children: t('emgPatientName') }),/*#__PURE__*/
                                        (0, _jsxRuntime.jsx)(_input.Input, {
                                            value: formData.name,
                                            onChangeText: function onChangeText(val) { return setFormData(Object.assign({}, formData, { name: val })); },
                                            placeholder: "Enter patient name"
                                        })]
                                }),/*#__PURE__*/

                                // Age and Gender row
                                (0, _jsxRuntime.jsxs)(_reactNative.View, {
                                    style: { flexDirection: 'row', gap: 12 }, children: [/*#__PURE__*/
                                        (0, _jsxRuntime.jsxs)(_reactNative.View, {
                                            style: { flex: 1 }, children: [/*#__PURE__*/
                                                (0, _jsxRuntime.jsx)(_label.Label, { children: t('emgAge') }),/*#__PURE__*/
                                                (0, _jsxRuntime.jsx)(_input.Input, {
                                                    keyboardType: "numeric",
                                                    value: formData.age,
                                                    onChangeText: function onChangeText(val) { return setFormData(Object.assign({}, formData, { age: val })); },
                                                    placeholder: "Age"
                                                })]
                                        }),/*#__PURE__*/
                                        (0, _jsxRuntime.jsxs)(_reactNative.View, {
                                            style: { flex: 2 }, children: [/*#__PURE__*/
                                                (0, _jsxRuntime.jsx)(_label.Label, { children: t('emgGender') }),/*#__PURE__*/
                                                (0, _jsxRuntime.jsx)(_reactNative.View, {
                                                    style: styles.radioGroup, children:
                                                        ['male', 'female', 'other'].map(function (option) {
                                                            var isSelected = formData.gender === option;
                                                            var RadioIcon = isSelected ? _lucideReactNative.CircleDot : _lucideReactNative.Circle;
                                                            var genderTranslate = option === 'male' ? t('emgMale') : option === 'female' ? t('emgFemale') : t('emgOther');
                                                            return (/*#__PURE__*/
                                                                (0, _jsxRuntime.jsxs)(_reactNative.TouchableOpacity, {
                                                                    onPress: function onPress() { return setFormData(Object.assign({}, formData, { gender: option })); }, style: styles.radioOption, children: [/*#__PURE__*/
                                                                        (0, _jsxRuntime.jsx)(RadioIcon, { size: 18, color: isSelected ? '#2563eb' : '#9ca3af' }),/*#__PURE__*/
                                                                        (0, _jsxRuntime.jsx)(_reactNative.Text, { style: styles.radioText, children: genderTranslate })]
                                                                }, option));
                                                        })
                                                })]
                                        })]
                                }),/*#__PURE__*/

                                // Contact Number
                                (0, _jsxRuntime.jsxs)(_reactNative.View, {
                                    children: [/*#__PURE__*/
                                        (0, _jsxRuntime.jsx)(_label.Label, { children: t('emgContactNumber') }),/*#__PURE__*/
                                        (0, _jsxRuntime.jsx)(_input.Input, {
                                            keyboardType: "phone-pad",
                                            value: formData.contactNumber,
                                            onChangeText: function onChangeText(val) { return setFormData(Object.assign({}, formData, { contactNumber: val })); },
                                            placeholder: "Enter contact number"
                                        })]
                                }),/*#__PURE__*/

                                // Current Condition / Symptoms
                                (0, _jsxRuntime.jsxs)(_reactNative.View, {
                                    children: [/*#__PURE__*/
                                        (0, _jsxRuntime.jsx)(_label.Label, { children: t('emgConditionSymptoms') }),/*#__PURE__*/
                                        (0, _jsxRuntime.jsx)(_textarea.Textarea, {
                                            value: formData.conditionDetails,
                                            onChangeText: function onChangeText(val) { return setFormData(Object.assign({}, formData, { conditionDetails: val })); },
                                            placeholder: "Describe the current condition and symptoms",
                                            style: { marginTop: 8 }
                                        })]
                                }),/*#__PURE__*/

                                // Arrival Method
                                (0, _jsxRuntime.jsxs)(_reactNative.View, {
                                    children: [/*#__PURE__*/
                                        (0, _jsxRuntime.jsx)(_label.Label, { children: t('emgArrivalMethod') }),/*#__PURE__*/
                                        (0, _jsxRuntime.jsx)(_reactNative.View, {
                                            style: [styles.radioGroup, { marginTop: 8 }], children:
                                                [
                                                    { value: 'ambulance', label: '🚑 ' + t('emgAmbulance') },
                                                    { value: 'own_transport', label: '🚗 ' + t('emgOwnTransport') },
                                                    { value: 'already_here', label: '🏥 ' + t('emgAlreadyHere') }
                                                ].map(function (option) {
                                                    var isSelected = formData.arrivalMethod === option.value;
                                                    return (/*#__PURE__*/
                                                        (0, _jsxRuntime.jsx)(_reactNative.TouchableOpacity, {
                                                            onPress: function onPress() { return setFormData(Object.assign({}, formData, { arrivalMethod: option.value })); },
                                                            style: [styles.arrivalOption, isSelected && styles.arrivalOptionSelected], children: /*#__PURE__*/
                                                                (0, _jsxRuntime.jsx)(_reactNative.Text, { style: [styles.arrivalOptionText, isSelected && { color: '#fff' }], children: option.label })
                                                        }, option.value));
                                                })
                                        })]
                                }),/*#__PURE__*/

                                // Estimated Arrival Time (optional)
                                (0, _jsxRuntime.jsxs)(_reactNative.View, {
                                    children: [/*#__PURE__*/
                                        (0, _jsxRuntime.jsx)(_label.Label, { children: "Estimated Arrival Time (optional)" }),/*#__PURE__*/
                                        (0, _jsxRuntime.jsx)(_input.Input, {
                                            value: formData.estimatedArrival,
                                            onChangeText: function onChangeText(val) { return setFormData(Object.assign({}, formData, { estimatedArrival: val })); },
                                            placeholder: "e.g. 10 minutes, 2:30 PM"
                                        })]
                                }),/*#__PURE__*/

                                // Accessibility Assistance
                                (0, _jsxRuntime.jsxs)(_reactNative.View, {
                                    style: { marginTop: 8 }, children: [/*#__PURE__*/
                                        (0, _jsxRuntime.jsxs)(_reactNative.View, {
                                            style: styles.row, children: [/*#__PURE__*/
                                                (0, _jsxRuntime.jsx)(_checkbox.Checkbox, {
                                                    checked: formData.hasDisability,
                                                    onCheckedChange: function onCheckedChange(val) { return setFormData(Object.assign({}, formData, { hasDisability: !!val })); }
                                                }),/*#__PURE__*/
                                                (0, _jsxRuntime.jsx)(_reactNative.Text, { style: { marginLeft: 8, fontWeight: '500' }, children: t('emgNeedsAccessibility') })]
                                        }),

                                        formData.hasDisability && /*#__PURE__*/
                                        (0, _jsxRuntime.jsxs)(_reactNative.View, {
                                            style: styles.disabilityBox, children: [/*#__PURE__*/
                                                (0, _jsxRuntime.jsx)(_reactNative.Text, { style: { fontWeight: '500', marginBottom: 8 }, children: t('emgSupportRequired') }),
                                                assistanceOptions.map(function (opt) {
                                                    return (/*#__PURE__*/
                                                        (0, _jsxRuntime.jsxs)(_reactNative.View, {
                                                            style: [styles.row, { marginBottom: 8 }], children: [/*#__PURE__*/
                                                                (0, _jsxRuntime.jsx)(_checkbox.Checkbox, {
                                                                    checked: formData.assistanceNeeded.includes(opt),
                                                                    onCheckedChange: function onCheckedChange(checked) { return handleAssistanceChange(opt, !!checked); }
                                                                }),/*#__PURE__*/
                                                                (0, _jsxRuntime.jsx)(_reactNative.Text, { style: { marginLeft: 8 }, children: t(assistanceOptionKeys[opt]) || opt })]
                                                        }, opt));
                                                }),/*#__PURE__*/
                                                (0, _jsxRuntime.jsxs)(_reactNative.View, {
                                                    style: { marginTop: 8 }, children: [/*#__PURE__*/
                                                        (0, _jsxRuntime.jsx)(_label.Label, { children: t('emgOtherAssistance') }),/*#__PURE__*/
                                                        (0, _jsxRuntime.jsx)(_input.Input, {
                                                            value: formData.otherAssistance,
                                                            onChangeText: function onChangeText(val) { return setFormData(Object.assign({}, formData, { otherAssistance: val })); },
                                                            placeholder: "Describe other assistance needed"
                                                        })]
                                                })]
                                        })]
                                }),/*#__PURE__*/

                                // Submit button
                                (0, _jsxRuntime.jsxs)(_button.Button, {
                                    onPress: handleFormSubmit, variant: "destructive", style: { marginTop: 16 },
                                    disabled: isSubmitting, children: [/*#__PURE__*/
                                        (0, _jsxRuntime.jsx)(_lucideReactNative.AlertTriangle, { size: 16, color: "#fff", style: { marginRight: 8 } }),/*#__PURE__*/
                                        (0, _jsxRuntime.jsx)(_reactNative.Text, { style: { color: '#fff', fontWeight: 'bold' }, children: isSubmitting ? t('emgAlerting') : t('emgAlertBtn') })]
                                })]
                        })]
                })]
        }));
}

var styles = _reactNative.StyleSheet.create({
    container: { padding: 24, paddingBottom: 40, backgroundColor: '#f0fdfa', flexGrow: 1 },
    confirmContainer: { padding: 24, paddingBottom: 40, backgroundColor: '#f0fdfa', flexGrow: 1, justifyContent: 'center' },
    cardSpacing: { marginBottom: 20 },
    row: { flexDirection: 'row', alignItems: 'center' },
    rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    radioGroup: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginTop: 8 },
    radioOption: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: '#ffffff', borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0' },
    radioText: { fontSize: 14, color: '#334155', fontWeight: '500' },
    disabilityBox: { marginTop: 16, padding: 16, backgroundColor: '#f0fdfa', borderRadius: 12, borderLeftWidth: 6, borderLeftColor: '#14b8a6' },
    arrivalOption: {
        paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12,
        borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#ffffff'
    },
    arrivalOptionSelected: {
        backgroundColor: '#dc2626', borderColor: '#dc2626'
    },
    arrivalOptionText: { fontSize: 14, fontWeight: '600', color: '#334155' },
    // Confirmation screen
    confirmCard: { borderWidth: 2, borderRadius: 16, overflow: 'hidden' },
    confirmIconRow: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 16 },
    confirmIconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#f0fdf4', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    confirmTitle: { fontSize: 22, fontWeight: '800', color: '#15803d', marginBottom: 8, textAlign: 'center' },
    confirmSub: { fontSize: 14, color: '#4b5563', textAlign: 'center', lineHeight: 20 },
    confirmDetails: { paddingHorizontal: 20, paddingVertical: 16, backgroundColor: '#f8fafc', gap: 12 },
    confirmRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    confirmLabel: { fontSize: 14, color: '#64748b', fontWeight: '500' },
    confirmValue: { fontSize: 14, color: '#1e293b', fontWeight: '600', flexShrink: 1, textAlign: 'right', maxWidth: '60%' },
    severityBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
    severityBadgeText: { color: '#fff', fontSize: 12, fontWeight: '800', letterSpacing: 1 },
    confirmNotice: { padding: 16, backgroundColor: '#fef3c7', borderBottomLeftRadius: 14, borderBottomRightRadius: 14 },
    confirmNoticeText: { fontSize: 13, color: '#92400e', textAlign: 'center', lineHeight: 18 }
});

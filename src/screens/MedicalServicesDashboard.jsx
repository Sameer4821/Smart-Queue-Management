var _interopRequireWildcard = require("@babel/runtime/helpers/interopRequireWildcard");
var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault"); Object.defineProperty(exports, "__esModule", { value: true }); exports.PatientDashboard = PatientDashboard; var _asyncToGenerator2 = _interopRequireDefault(require("@babel/runtime/helpers/asyncToGenerator")); var _slicedToArray2 = _interopRequireDefault(require("@babel/runtime/helpers/slicedToArray")); var _react = _interopRequireWildcard(require("react"));
var _reactNative = require("react-native");
var _useTranslation = require("../hooks/useTranslation");
var _Settings = require("../components/Settings");
var _DepartmentStatistics = require("../components/DepartmentStatistics");
var _PatientHistory = require("../components/PatientHistory");

var _button = require("../components/ui/button");
var _card = require("../components/ui/card");
var _badge = require("../components/ui/badge");
var _input = require("../components/ui/input");

var _lucideReactNative = require("lucide-react-native");
var _asyncStorage = _interopRequireDefault(require("@react-native-async-storage/async-storage")); 
var _jsxRuntime = require("react/jsx-runtime");



function PatientDashboard() {
    var _useWindowDimensions = (0, _reactNative.useWindowDimensions)(), width = _useWindowDimensions.width;
    var isMobile = width < 768;
    var _useAppContext = require("../context/AppContext").useAppContext(), state = _useAppContext.state, setState = _useAppContext.setState;
    var t = (0, _useTranslation.useTranslation)().t;
    var _useState = (0, _react.useState)(false), _useState2 = (0, _slicedToArray2.default)(_useState, 2), showSettings = _useState2[0], setShowSettings = _useState2[1];
    var _useState3 = (0, _react.useState)(false), _useState4 = (0, _slicedToArray2.default)(_useState3, 2), showDepartmentStats = _useState4[0], setShowDepartmentStats = _useState4[1];
    var _useState5 = (0, _react.useState)(false), _useState6 = (0, _slicedToArray2.default)(_useState5, 2), showPatientHistory = _useState6[0], setShowPatientHistory = _useState6[1];
    var remainingEmergency = state.maxEmergencyPerDay - state.emergencyCount;

    var _useState7 = (0, _react.useState)(null), _useState8 = (0, _slicedToArray2.default)(_useState7, 2), latestPrescription = _useState8[0], setLatestPrescription = _useState8[1];
    var pulseAnim = (0, _react.useRef)(new _reactNative.Animated.Value(0)).current;

    var _firebase = require("../services/firebase");

    (0, _react.useEffect)(function () {
        if (!state.patientInfo) return;
        var patientId = state.patientInfo.phone || state.patientInfo.email;
        if (!patientId) return;

        var activeToken = state.tokens.find(function (t) { return (t.patient && (t.patient.email === state.patientInfo.email || t.patient.phone === state.patientInfo.phone)) && t.status === 'active'; });
        if (!activeToken) return;

        var q = (0, _firebase.query)(
            (0, _firebase.collection)(_firebase.db, 'prescriptions'),
            (0, _firebase.where)('token_id', '==', activeToken.id)
        );

        var unsubscribe = (0, _firebase.onSnapshot)(q, function(snapshot) {
            snapshot.forEach(function(docSnap) {
                setLatestPrescription(docSnap.data());
            });
        }, function(err) {
            console.error("Firestore MedicalServicesDashboard prescription sub error:", err);
        });

        return function() {
            unsubscribe();
        };
    }, [state.patientInfo, state.tokens]);

    (0, _react.useEffect)(function () {
        if (latestPrescription) {
            _reactNative.Animated.loop(
                _reactNative.Animated.sequence([
                    _reactNative.Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: false }),
                    _reactNative.Animated.timing(pulseAnim, { toValue: 0, duration: 800, useNativeDriver: false })
                ])
            ).start();
        } else {
            pulseAnim.setValue(0);
        }
    }, [latestPrescription]);

    var patientTokens = state.tokens.filter(function (tok) {
        var _state$patientInfo;
        const patientPhone = (_state$patientInfo = state.patientInfo) == null ? void 0 : _state$patientInfo.phone;
        const patientEmail = (_state$patientInfo = state.patientInfo) == null ? void 0 : _state$patientInfo.email;
        const tokPhone = tok.patient_phone || (tok.patient && tok.patient.phone);
        const tokEmail = tok.patient && tok.patient.email;
        if (patientPhone && tokPhone) {
            return tokPhone === patientPhone;
        }
        if (patientEmail && tokEmail) {
            return tokEmail === patientEmail;
        }
        return false;
    });
    const activePatientToken = patientTokens.find(function(tok) {
        return tok.status !== 'completed' && tok.status !== 'cancelled';
    });

    const _useStateSymptoms = (0, _react.useState)('');
    const symptomsInput = _useStateSymptoms[0];
    const setSymptomsInput = _useStateSymptoms[1];

    const _useStateUpdating = (0, _react.useState)(false);
    const isUpdatingSymptoms = _useStateUpdating[0];
    const setIsUpdatingSymptoms = _useStateUpdating[1];

    (0, _react.useEffect)(function() {
        if (activePatientToken) {
            setSymptomsInput(activePatientToken.patient?.symptoms || '');
        }
    }, [activePatientToken?.id]);

    const handleUpdateSymptoms = /*#__PURE__*/function () {
        var _refSymptoms = (0, _asyncToGenerator2.default)(function* () {
            if (!activePatientToken || isUpdatingSymptoms) return;
            setIsUpdatingSymptoms(true);
            try {
                const updatedToken = Object.assign({}, activePatientToken, {
                    patient: Object.assign({}, activePatientToken.patient, {
                        symptoms: symptomsInput
                    })
                });
                
                const _firebase = require("../services/firebase");
                try {
                    yield (0, _firebase.updateDoc)((0, _firebase.doc)(_firebase.db, 'tokens', activePatientToken.id), {
                        patient: updatedToken.patient,
                        updatedAt: new Date().toISOString()
                    });
                } catch (fbErr) {
                    console.error("Failed to update symptoms in Firestore:", fbErr);
                }

                setState(function(prev) {
                    return Object.assign({}, prev, {
                        tokens: prev.tokens.map(function(t) { return t.id === activePatientToken.id ? updatedToken : t; }),
                        currentToken: prev.currentToken && prev.currentToken.id === activePatientToken.id ? updatedToken : prev.currentToken
                    });
                });
            } catch (err) {
                console.error("Error updating symptoms:", err);
            } finally {
                setIsUpdatingSymptoms(false);
            }
        }); return function handleUpdateSymptoms() { return _refSymptoms.apply(this, arguments); };
    }();

    var handleCategorySelect = function handleCategorySelect(category) {
        setState(function (prev) { return Object.assign({}, prev, { currentView: category }); });
    };

    var handleLogout =/*#__PURE__*/function () {
        var _ref = (0, _asyncToGenerator2.default)(function* () {
            yield _asyncStorage.default.removeItem('current-patient-info');
            setState(function (prev) {
                return Object.assign({},
                    prev, {
                    currentView: 'portal',
                    patientInfo: null
                });
            }
            );
        }); return function handleLogout() { return _ref.apply(this, arguments); };
    }();

    var handleChangeDetails = function handleChangeDetails() {
        setState(function (prev) { return Object.assign({}, prev, { currentView: 'patient-details' }); });
    };

    if (!state.patientInfo) {
        return (/*#__PURE__*/
            (0, _jsxRuntime.jsxs)(_reactNative.View, {
                style: styles.loadingContainer, children: [/*#__PURE__*/
                    (0, _jsxRuntime.jsx)(_reactNative.ActivityIndicator, { size: "large", color: "#2563eb" }),/*#__PURE__*/
                    (0, _jsxRuntime.jsx)(_reactNative.Text, { style: styles.loadingText, children: "Loading your dashboard..." })]
            }
            ));

    }

    if (showSettings) return/*#__PURE__*/(0, _jsxRuntime.jsx)(_Settings.Settings, { onClose: function onClose() { return setShowSettings(false); } });
    if (showDepartmentStats) return/*#__PURE__*/(0, _jsxRuntime.jsx)(_DepartmentStatistics.DepartmentStatistics, { onBack: function onBack() { return setShowDepartmentStats(false); } });
    if (showPatientHistory) return/*#__PURE__*/(0, _jsxRuntime.jsx)(_PatientHistory.PatientHistory, { onBack: function onBack() { return setShowPatientHistory(false); } });

    // patientTokens and activePatientToken logic moved to top of component
    var totalVisits = patientTokens.flatMap(function (token) { return token.visits || []; }).length;
    var totalRecords = patientTokens.flatMap(function (token) { return token.prescriptions || []; }).length + patientTokens.flatMap(function (token) { return token.labTests || []; }).length;

    return (/*#__PURE__*/
        (0, _jsxRuntime.jsxs)(_reactNative.ScrollView, {
            contentContainerStyle: styles.container, children: [/*#__PURE__*/

                (0, _jsxRuntime.jsx)(_card.Card, {
                    style: styles.card, children:/*#__PURE__*/
                        (0, _jsxRuntime.jsx)(_card.CardHeader, {
                            children:/*#__PURE__*/
                                (0, _jsxRuntime.jsxs)(_reactNative.View, {
                                    style: [styles.headerRow, isMobile && { flexDirection: 'column', alignItems: 'stretch' }], children: [/*#__PURE__*/
                                        (0, _jsxRuntime.jsxs)(_reactNative.View, {
                                            style: { flex: 1 }, children: [/*#__PURE__*/
                                                (0, _jsxRuntime.jsx)(_reactNative.Text, { style: styles.title, children: t.pdTitle }),/*#__PURE__*/
                                                (0, _jsxRuntime.jsx)(_reactNative.Text, { style: styles.subtitle, children: t.pdSubtitle })]
                                        }
                                        ),/*#__PURE__*/
                                        (0, _jsxRuntime.jsxs)(_reactNative.View, {
                                            style: [styles.headerActions, isMobile && { alignItems: 'stretch', width: '100%', marginTop: 16 }], children: [/*#__PURE__*/
                                                (0, _jsxRuntime.jsxs)(_button.Button, {
                                                    variant: "outline", size: "sm", onPress: function onPress() { return setShowSettings(true); }, style: { marginBottom: 8 }, children: [/*#__PURE__*/
                                                        (0, _jsxRuntime.jsx)(_lucideReactNative.Settings, { size: 16, color: "#374151", style: { marginRight: 4 } }),/*#__PURE__*/
                                                        (0, _jsxRuntime.jsx)(_reactNative.Text, { children: "Settings" })]
                                                }
                                                ),/*#__PURE__*/
                                                (0, _jsxRuntime.jsx)(_button.Button, {
                                                    variant: "outline", size: "sm", onPress: handleChangeDetails, style: { marginBottom: 8 }, children:/*#__PURE__*/
                                                        (0, _jsxRuntime.jsx)(_reactNative.Text, { children: t.pdChangeDetails })
                                                }
                                                ),/*#__PURE__*/
                                                (0, _jsxRuntime.jsxs)(_button.Button, {
                                                    variant: "ghost", size: "sm", onPress: handleLogout, children: [/*#__PURE__*/
                                                        (0, _jsxRuntime.jsx)(_lucideReactNative.LogOut, { size: 16, color: "#ef4444", style: { marginRight: 4 } }),/*#__PURE__*/
                                                        (0, _jsxRuntime.jsx)(_reactNative.Text, { style: { color: '#ef4444' }, children: t.pdLogout })]
                                                }
                                                )]
                                        }
                                        )]
                                }
                                )
                        }
                        )
                }
                ),/*#__PURE__*/


                (0, _jsxRuntime.jsx)(_card.Card, {
                    style: [styles.card, { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }], children:/*#__PURE__*/
                        (0, _jsxRuntime.jsxs)(_card.CardContent, {
                            style: styles.welcomeContent, children: [/*#__PURE__*/
                                (0, _jsxRuntime.jsxs)(_reactNative.View, {
                                    style: [styles.welcomeRow, isMobile && { flexDirection: 'column', textAlign: 'center' }], children: [/*#__PURE__*/
                                        (0, _jsxRuntime.jsx)(_reactNative.View, { style: styles.userIconWrap, children:/*#__PURE__*/(0, _jsxRuntime.jsx)(_lucideReactNative.User, { size: 24, color: "#2563eb" }) }),/*#__PURE__*/
                                        (0, _jsxRuntime.jsxs)(_reactNative.View, {
                                            style: [{ flex: 1, minWidth: 0 }, isMobile && { marginRight: 0 }], children: [/*#__PURE__*/
                                                (0, _jsxRuntime.jsx)(_reactNative.Text, { style: [styles.welcomeTitle, isMobile && styles.welcomeTitleMobile], numberOfLines: 2, children: state.patientInfo.name ? `${t.pdWelcomeBack}, ${state.patientInfo.name}` : t.pdWelcomeBack }),/*#__PURE__*/
                                                state.patientInfo.email ? (0, _jsxRuntime.jsx)(_reactNative.Text, { style: [styles.welcomeSub, isMobile && styles.welcomeSubMobile], numberOfLines: 1, children: state.patientInfo.email }) : null,/*#__PURE__*/
                                                state.patientInfo.phone ? (0, _jsxRuntime.jsx)(_reactNative.Text, { style: [styles.welcomeSub, isMobile && styles.welcomeSubMobile], numberOfLines: 1, children: state.patientInfo.phone }) : null]
                                        }
                                        ),/*#__PURE__*/
                                        (0, _jsxRuntime.jsx)(_badge.Badge, { variant: "secondary", children:/*#__PURE__*/(0, _jsxRuntime.jsx)(_reactNative.Text, { children: t.pdLoggedInAs }) })]
                                }
                                ),/*#__PURE__*/
                                 activePatientToken ? (0, _jsxRuntime.jsxs)(_card.Card, {
                                    style: { 
                                        backgroundColor: '#f0f9ff', 
                                        borderColor: '#bae6fd', 
                                        borderWidth: 2, 
                                        borderRadius: 12, 
                                        padding: 16, 
                                        marginTop: 16, 
                                        width: '100%' 
                                    },
                                    children: [
                                        (0, _jsxRuntime.jsxs)(_reactNative.Text, { style: { fontSize: 18, fontWeight: 'bold', color: '#0369a1' }, children: ["Active Token / క్రియాశీల టోకెన్: ", activePatientToken.id] }),
                                        (0, _jsxRuntime.jsxs)(_reactNative.Text, { style: { fontSize: 14, color: '#0284c7', marginTop: 4 }, children: ["Department: ", activePatientToken.primaryDepartment] }),
                                        (0, _jsxRuntime.jsxs)(_reactNative.Text, { style: { fontSize: 14, color: '#0369a1', marginTop: 8, fontWeight: 'bold' }, children: ["Symptoms: ", activePatientToken.patient?.symptoms || "None"] }),
                                        (0, _jsxRuntime.jsxs)(_reactNative.View, { 
                                            style: { flexDirection: 'row', gap: 8, marginTop: 8, alignItems: 'center' },
                                            children: [
                                                (0, _jsxRuntime.jsx)(_input.Input, {
                                                    style: { flex: 1, height: 40, borderColor: '#bae6fd', backgroundColor: '#ffffff' },
                                                    value: symptomsInput,
                                                    onChangeText: setSymptomsInput,
                                                    placeholder: "Enter/Update symptoms"
                                                }),
                                                (0, _jsxRuntime.jsx)(_button.Button, {
                                                    style: { backgroundColor: '#0284c7', height: 40, justifyContent: 'center' },
                                                    disabled: isUpdatingSymptoms,
                                                    onPress: handleUpdateSymptoms,
                                                    children: (0, _jsxRuntime.jsx)(_reactNative.Text, { style: { color: '#fff', fontWeight: 'bold' }, children: isUpdatingSymptoms ? "Saving..." : "Update" })
                                                })
                                            ]
                                        }),
                                        (0, _jsxRuntime.jsx)(_button.Button, {
                                            style: { marginTop: 12, backgroundColor: '#0284c7' },
                                            onPress: function() {
                                                setState(function(prev) {
                                                    return Object.assign({}, prev, {
                                                        currentToken: activePatientToken,
                                                        currentView: 'token'
                                                    });
                                                });
                                            },
                                            children: (0, _jsxRuntime.jsx)(_reactNative.Text, { style: { color: '#fff', fontWeight: 'bold' }, children: "View Live Status / లైవ్ స్థితిని చూడండి" })
                                        })
                                    ]
                                 }) : (0, _jsxRuntime.jsx)(_reactNative.View, { style: { alignItems: 'center', marginTop: 16 } })
                                 ]
                        }
                        )
                }
                ),/*#__PURE__*/


                (0, _jsxRuntime.jsxs)(_card.Card, {
                    style: styles.card, children: [/*#__PURE__*/
                        (0, _jsxRuntime.jsx)(_card.CardHeader, {
                            style: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }, children:/*#__PURE__*/
                                (0, _jsxRuntime.jsx)(_card.CardTitle, { children: t.pdSelectCategory })
                        }
                        ),/*#__PURE__*/
                        (0, _jsxRuntime.jsxs)(_card.CardContent, {
                            style: styles.grid, children: [/*#__PURE__*/

                                (0, _jsxRuntime.jsx)(_reactNative.TouchableOpacity, {
                                    onPress: function onPress() { return handleCategorySelect('common'); }, activeOpacity: 0.8, style: { width: '100%' }, children:/*#__PURE__*/
                                        (0, _jsxRuntime.jsx)(_card.Card, {
                                            style: [styles.cardItem, { borderLeftWidth: 4, borderLeftColor: '#3b82f6' }], children:/*#__PURE__*/
                                                (0, _jsxRuntime.jsxs)(_card.CardHeader, {
                                                    style: [styles.itemHeader, isMobile && { flexDirection: 'column', alignItems: 'center', paddingBottom: 16 }], children: [/*#__PURE__*/
                                                        (0, _jsxRuntime.jsx)(_reactNative.View, { style: [styles.iconBox, { backgroundColor: '#dbeafe' }], children:/*#__PURE__*/(0, _jsxRuntime.jsx)(_lucideReactNative.Users, { size: 32, color: "#2563eb" }) }),/*#__PURE__*/
                                                        (0, _jsxRuntime.jsxs)(_reactNative.View, {
                                                            style: [{ flex: 1, marginLeft: 16 }, isMobile && { flex: 0, marginLeft: 0, marginTop: 16, marginBottom: 16, alignItems: 'center' }], children: [/*#__PURE__*/
                                                                (0, _jsxRuntime.jsx)(_card.CardTitle, { style: [{ color: '#2563eb' }, isMobile && { flexWrap: 'wrap', textAlign: 'center' }], children: t.pdCommon }),/*#__PURE__*/
                                                                (0, _jsxRuntime.jsx)(_card.CardDescription, { style: [isMobile && { flexWrap: 'wrap', textAlign: 'center' }], children: t.pdCommonDesc })]
                                                        }
                                                        ),/*#__PURE__*/
                                                        (0, _jsxRuntime.jsxs)(_reactNative.View, {
                                                            style: [{ alignItems: 'flex-end' }, isMobile && { alignItems: 'center', width: '100%', marginTop: 8 }], children: [/*#__PURE__*/
                                                                (0, _jsxRuntime.jsx)(_badge.Badge, { variant: "outline", children:/*#__PURE__*/(0, _jsxRuntime.jsxs)(_reactNative.Text, { children: ["Queue: ", state.tokens.filter(function (tok) { return tok.type === 'common' && (tok.status === 'active' || tok.status === 'waiting'); }).length] }) }),/*#__PURE__*/
                                                                (0, _jsxRuntime.jsx)(_button.Button, { style: { marginTop: 8 }, onPress: function onPress() { return handleCategorySelect('common'); }, children:/*#__PURE__*/(0, _jsxRuntime.jsx)(_reactNative.Text, { style: { color: '#fff' }, children: t.pdSelect }) })]
                                                        }
                                                        )]
                                                }
                                                )
                                        }
                                        )
                                }
                                ),/*#__PURE__*/

                                (0, _jsxRuntime.jsx)(_reactNative.TouchableOpacity, {
                                    onPress: function onPress() { return remainingEmergency > 0 && handleCategorySelect('emergency'); }, activeOpacity: remainingEmergency > 0 ? 0.8 : 1, style: { width: '100%' }, children:/*#__PURE__*/
                                        (0, _jsxRuntime.jsx)(_card.Card, {
                                            style: [styles.cardItem, { borderLeftWidth: 4, borderLeftColor: '#ef4444', opacity: remainingEmergency > 0 ? 1 : 0.6 }], children:/*#__PURE__*/
                                                (0, _jsxRuntime.jsxs)(_card.CardHeader, {
                                                    style: [styles.itemHeader, isMobile && { flexDirection: 'column', alignItems: 'center', paddingBottom: 16 }], children: [/*#__PURE__*/
                                                        (0, _jsxRuntime.jsx)(_reactNative.View, { style: [styles.iconBox, { backgroundColor: '#fee2e2' }], children:/*#__PURE__*/(0, _jsxRuntime.jsx)(_lucideReactNative.AlertTriangle, { size: 32, color: "#dc2626" }) }),/*#__PURE__*/
                                                        (0, _jsxRuntime.jsxs)(_reactNative.View, {
                                                            style: [{ flex: 1, marginLeft: 16 }, isMobile && { flex: 0, marginLeft: 0, marginTop: 16, marginBottom: 16, alignItems: 'center' }], children: [/*#__PURE__*/
                                                                (0, _jsxRuntime.jsx)(_card.CardTitle, { style: [{ color: '#dc2626' }, isMobile && { flexWrap: 'wrap', textAlign: 'center' }], children: t.pdEmergency }),/*#__PURE__*/
                                                                (0, _jsxRuntime.jsx)(_card.CardDescription, { style: [isMobile && { flexWrap: 'wrap', textAlign: 'center' }], children: t.pdEmergencyDesc })]
                                                        }
                                                        ),/*#__PURE__*/
                                                        (0, _jsxRuntime.jsxs)(_reactNative.View, {
                                                            style: [{ alignItems: 'flex-end' }, isMobile && { alignItems: 'center', width: '100%', marginTop: 8 }], children: [/*#__PURE__*/
                                                                (0, _jsxRuntime.jsx)(_badge.Badge, { variant: "destructive", children:/*#__PURE__*/(0, _jsxRuntime.jsxs)(_reactNative.Text, { style: { color: '#fff' }, children: ["Queue: ", state.tokens.filter(function (tok) { return tok.type === 'emergency' && (tok.status === 'active' || tok.status === 'waiting'); }).length] }) }),/*#__PURE__*/
                                                                (0, _jsxRuntime.jsx)(_button.Button, {
                                                                    variant: "destructive",
                                                                    disabled: remainingEmergency <= 0,
                                                                    onPress: function onPress() { return remainingEmergency > 0 && handleCategorySelect('emergency'); },
                                                                    style: { marginTop: 8 },
                                                                    children: (0, _jsxRuntime.jsx)(_reactNative.Text, { style: { color: '#fff' }, children: remainingEmergency <= 0 ? t.pdLimitReached : t.pdSelect })
                                                                })]
                                                        }
                                                        )]
                                                }
                                                )
                                        }
                                        )
                                }
                                ),/*#__PURE__*/

                                (0, _jsxRuntime.jsx)(_reactNative.TouchableOpacity, {
                                    onPress: function onPress() { return handleCategorySelect('disabled'); }, activeOpacity: 0.8, style: { width: '100%' }, children:/*#__PURE__*/
                                        (0, _jsxRuntime.jsx)(_card.Card, {
                                            style: [styles.cardItem, { borderLeftWidth: 4, borderLeftColor: '#3b82f6' }], children:/*#__PURE__*/
                                                (0, _jsxRuntime.jsxs)(_card.CardHeader, {
                                                    style: [styles.itemHeader, isMobile && { flexDirection: 'column', alignItems: 'center', paddingBottom: 16 }], children: [/*#__PURE__*/
                                                        (0, _jsxRuntime.jsx)(_reactNative.View, { style: [styles.iconBox, { backgroundColor: '#dbeafe' }], children:/*#__PURE__*/(0, _jsxRuntime.jsx)(_lucideReactNative.Accessibility, { size: 32, color: "#2563eb" }) }),/*#__PURE__*/
                                                        (0, _jsxRuntime.jsxs)(_reactNative.View, {
                                                            style: [{ flex: 1, marginLeft: 16 }, isMobile && { flex: 0, marginLeft: 0, marginTop: 16, marginBottom: 16, alignItems: 'center' }], children: [/*#__PURE__*/
                                                                (0, _jsxRuntime.jsx)(_card.CardTitle, { style: [{ color: '#2563eb' }, isMobile && { flexWrap: 'wrap', textAlign: 'center' }], children: t.pdDisabled }),/*#__PURE__*/
                                                                (0, _jsxRuntime.jsx)(_card.CardDescription, { style: [isMobile && { flexWrap: 'wrap', textAlign: 'center' }], children: t.pdDisabledDesc })]
                                                        }
                                                        ),/*#__PURE__*/
                                                        (0, _jsxRuntime.jsxs)(_reactNative.View, {
                                                            style: [{ alignItems: 'flex-end' }, isMobile && { alignItems: 'center', width: '100%', marginTop: 8 }], children: [/*#__PURE__*/
                                                                (0, _jsxRuntime.jsx)(_badge.Badge, { variant: "secondary", children:/*#__PURE__*/(0, _jsxRuntime.jsxs)(_reactNative.Text, { children: ["Queue: ", state.tokens.filter(function (tok) { return tok.type === 'disabled' && (tok.status === 'active' || tok.status === 'waiting'); }).length] }) }),/*#__PURE__*/
                                                                (0, _jsxRuntime.jsx)(_button.Button, { style: { marginTop: 8 }, onPress: function onPress() { return handleCategorySelect('disabled'); }, children:/*#__PURE__*/(0, _jsxRuntime.jsx)(_reactNative.Text, { style: { color: '#fff' }, children: t.pdSelect }) })]
                                                        }
                                                        )]
                                                }
                                                )
                                        }
                                        )
                                }
                                )]
                        }

                        )]
                }
                ),/*#__PURE__*/


                (0, _jsxRuntime.jsx)(_reactNative.TouchableOpacity, {
                    onPress: function onPress() { return setShowDepartmentStats(true); }, activeOpacity: 0.8, style: styles.card, children:/*#__PURE__*/
                        (0, _jsxRuntime.jsx)(_card.Card, {
                            children:/*#__PURE__*/
                                (0, _jsxRuntime.jsxs)(_card.CardHeader, {
                                    style: styles.rowBetween, children: [/*#__PURE__*/
                                        (0, _jsxRuntime.jsxs)(_reactNative.View, {
                                            style: styles.rowCenter, children: [/*#__PURE__*/
                                                (0, _jsxRuntime.jsx)(_lucideReactNative.Activity, { size: 24, color: "#2563eb", style: { marginRight: 12 } }),/*#__PURE__*/
                                                (0, _jsxRuntime.jsxs)(_reactNative.View, {
                                                    children: [/*#__PURE__*/
                                                        (0, _jsxRuntime.jsx)(_card.CardTitle, { style: { color: '#2563eb' }, children: t.pdDepartmentStats }),/*#__PURE__*/
                                                        (0, _jsxRuntime.jsx)(_card.CardDescription, { children: "View detailed information" })]
                                                }
                                                )]
                                        }
                                        ),/*#__PURE__*/
                                        (0, _jsxRuntime.jsxs)(_reactNative.View, {
                                            style: styles.rowCenter, children: [/*#__PURE__*/
                                                (0, _jsxRuntime.jsx)(_badge.Badge, { variant: "outline", children:/*#__PURE__*/(0, _jsxRuntime.jsxs)(_reactNative.Text, { children: [state.departments.length, " Depts"] }) }),/*#__PURE__*/
                                                (0, _jsxRuntime.jsx)(_lucideReactNative.ArrowRight, { size: 20, color: "#2563eb", style: { marginLeft: 8 } })]
                                        }
                                        )]
                                }
                                )
                        }
                        )
                }
                ),/*#__PURE__*/

                (0, _jsxRuntime.jsx)(_reactNative.TouchableOpacity, {
                    onPress: function onPress() { return setShowPatientHistory(true); }, activeOpacity: 0.8, style: styles.card, children:/*#__PURE__*/
                        (0, _jsxRuntime.jsx)(_card.Card, {
                            children:/*#__PURE__*/
                                (0, _jsxRuntime.jsxs)(_card.CardHeader, {
                                    style: styles.rowBetween, children: [/*#__PURE__*/
                                        (0, _jsxRuntime.jsxs)(_reactNative.View, {
                                            style: styles.rowCenter, children: [/*#__PURE__*/
                                                (0, _jsxRuntime.jsx)(_lucideReactNative.History, { size: 24, color: "#16a34a", style: { marginRight: 12 } }),/*#__PURE__*/
                                                (0, _jsxRuntime.jsxs)(_reactNative.View, {
                                                    children: [/*#__PURE__*/
                                                        (0, _jsxRuntime.jsx)(_card.CardTitle, { style: { color: '#16a34a' }, children: t.pdPatientHistory }),/*#__PURE__*/
                                                        (0, _jsxRuntime.jsx)(_card.CardDescription, { children: "Complete medical history" })]
                                                }
                                                )]
                                        }
                                        ),/*#__PURE__*/
                                        (0, _jsxRuntime.jsx)(_lucideReactNative.ArrowRight, { size: 20, color: "#16a34a" })]
                                }
                                )
                        }
                        )
                }
                )]
        }

        ));

}

var styles = _reactNative.StyleSheet.create({
    container: { padding: 16, gap: 16 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { marginTop: 16, color: '#4b5563' },
    card: { marginBottom: 16 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    title: { fontSize: 24, fontWeight: 'bold', color: '#1e3a8a' },
    subtitle: { color: '#6b7280' },
    headerActions: { alignItems: 'flex-end' },
    welcomeContent: { paddingTop: 24 },
    welcomeRow: { flexDirection: 'row', alignItems: 'center' },
    userIconWrap: { width: 48, height: 48, backgroundColor: '#dbeafe', borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
    welcomeTitle: { fontWeight: '600', color: '#1e40af', fontSize: 18 },
    welcomeSub: { fontSize: 14, color: '#6b7280' },
    grid: { gap: 16 },
    cardItem: { marginBottom: 12 },
    itemHeader: { flexDirection: 'row', alignItems: 'center' },
    iconBox: { padding: 12, borderRadius: 24 },
    rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    rowCenter: { flexDirection: 'row', alignItems: 'center' }
});
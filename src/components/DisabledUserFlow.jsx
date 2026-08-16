var _interopRequireWildcard = require("@babel/runtime/helpers/interopRequireWildcard");
var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault"); Object.defineProperty(exports, "__esModule", { value: true }); exports.DisabledUserFlow = DisabledUserFlow; var _toConsumableArray2 = _interopRequireDefault(require("@babel/runtime/helpers/toConsumableArray")); var _asyncToGenerator2 = _interopRequireDefault(require("@babel/runtime/helpers/asyncToGenerator")); var _slicedToArray2 = _interopRequireDefault(require("@babel/runtime/helpers/slicedToArray")); var _react = _interopRequireWildcard(require("react"));
var _reactNative = require("react-native");
var _AppContext = require("../context/AppContext");

var _button = require("./ui/button");
var _card = require("./ui/card");
var _input = require("./ui/input");
var _label = require("./ui/label");
var _checkbox = require("./ui/checkbox");

var _select = require("./ui/select");

<<<<<<< HEAD
var _lucideReactNative = require("lucide-react-native"); var _jsxRuntime = require("react/jsx-runtime");
// Firebase real-time integration active
=======
var _textarea = require("./ui/textarea");
var _lucideReactNative = require("lucide-react-native"); var _jsxRuntime = require("react/jsx-runtime"); function _interopRequireWildcard(e, t) { if ("function" == typeof WeakMap) var r = new WeakMap(), n = new WeakMap(); return (_interopRequireWildcard = function _interopRequireWildcard(e, t) { if (!t && e && e.__esModule) return e; var o, i, f = { __proto__: null, default: e }; if (null === e || "object" != typeof e && "function" != typeof e) return f; if (o = t ? n : r) { if (o.has(e)) return o.get(e); o.set(e, f); } for (var _t in e) "default" !== _t && {}.hasOwnProperty.call(e, _t) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, _t)) && (i.get || i.set) ? o(f, _t, i) : f[_t] = e[_t]); return f; })(e, t); }
var _supabaseClient = require("../services/supabaseClient");
var _useTranslation = require("../hooks/useTranslation");

var disabilityTypeKeys = {
    mobility: 'accMobility',
    visual: 'accVisual',
    hearing: 'accHearing',
    cognitive: 'accCognitive',
    multiple: 'accMultiple',
    other: 'accOther'
};

var assistanceOptionKeys = {
    'Wheelchair assistance': 'emgWheelchair',
    'Sign language interpreter': 'emgSignLanguage',
    'Audio assistance': 'emgAudio',
    'Personal care attendant': 'emgPersonalCare',
    'Accessible restroom': 'emgRestroom'
};

>>>>>>> origin/main

var disabilityTypes = [
    { value: 'mobility', label: 'Mobility Impairment', icon: _lucideReactNative.User },
    { value: 'visual', label: 'Visual Impairment', icon: _lucideReactNative.Eye },
    { value: 'hearing', label: 'Hearing Impairment', icon: _lucideReactNative.Ear },
    { value: 'cognitive', label: 'Cognitive Disability', icon: _lucideReactNative.Heart },
    { value: 'multiple', label: 'Multiple Disabilities', icon: _lucideReactNative.Users },
    { value: 'other', label: 'Other', icon: _lucideReactNative.Accessibility }];


var assistanceOptions = [
    'Wheelchair assistance',
    'Sign language interpreter',
    'Audio assistance',
    'Personal care attendant',
    'Accessible restroom'];




















function DisabledUserFlow() {
    var _useAppContext = (0, _AppContext.useAppContext)(), state = _useAppContext.state, setState = _useAppContext.setState;
    var _useTranslation2 = (0, _useTranslation.useTranslation)(), t = _useTranslation2.t;
    var _useState = (0, _react.useState)({

        name: state.patientInfo ? state.patientInfo.name : '',
        email: '',
        phone: '',
        age: 0,
        gender: '',
        primaryDepartment: '',
        disabilityType: '',
        disabilityDetails: '',
        assistanceNeeded: [],
        otherAssistance: '',
        caregiverName: '',
        caregiverPhone: '',
        urgency: 'normal',
        wheelchairNeeded: false,
        interpreterNeeded: false
    }), _useState2 = (0, _slicedToArray2.default)(_useState, 2), formData = _useState2[0], setFormData = _useState2[1];

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
        }
        );
    };

    var generateDisabledToken = function generateDisabledToken() {
        if (!state.patientInfo) throw new Error('Patient information not available');

        var now = new Date();
        var tokenNumber = String(state.tokens.filter(function (t) { return t.type === 'disabled'; }).length + 1).padStart(3, '0');
        var dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
        var timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');

        var tokenId = `ACE-${timeStr}-${tokenNumber}`;
        var endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);
        var patientId = `PAT-${dateStr}-${tokenNumber}`;
        var allDepartmentNames = state.departments.map(function (d) { return d.name; });

        var priority = formData.urgency === 'priority' ? 8 : 6;
        var allAssistanceNeeded = (0, _toConsumableArray2.default)(formData.assistanceNeeded);
        if (formData.otherAssistance.trim()) {
            allAssistanceNeeded.push(`Other: ${formData.otherAssistance.trim()}`);
        }

        return {
            id: tokenId,
            type: 'disabled',
            primaryDepartment: formData.primaryDepartment,
            timestamp: now,
            patient: {
                name: formData.name || state.patientInfo.name,
                email: state.patientInfo.email,
                phone: state.patientInfo.phone,
                age: formData.age,
                gender: formData.gender,
                patientId: patientId
            },
            status: 'active',
            priority: priority,
            disabilityType: formData.disabilityType,
            assistanceNeeded: allAssistanceNeeded,
            qrCode: tokenId,
            validUntil: endOfDay,
            createdAt: now,
            schedulingMethod: 'manual',
            visits: [],
            prescriptions: [],
            labTests: [],
            departmentAccess: allDepartmentNames
        };
    };

    var handleFormSubmit = /*#__PURE__*/function () {
        var _ref = (0, _asyncToGenerator2.default)(function* () {
            if (!formData.age || !formData.gender || !formData.primaryDepartment || !formData.disabilityType) {
                console.log('Please fill all required fields');
                return;
            }
            if (formData.assistanceNeeded.length === 0 && formData.otherAssistance.trim() === '') {
                console.log('Please select assistance needed');
                return;
            }
<<<<<<< HEAD
            
            var _firebase = require("../services/firebase");
            var userService = require("../services/userService");
            var asyncStorage = require("@react-native-async-storage/async-storage").default;

            try {
                var patientName = formData.name ? formData.name.trim() : (state.patientInfo ? state.patientInfo.name : '');
                
                // Save name to existing Firestore user record if entered
                if (patientName && state.patientInfo) {
                    yield userService.saveUserNameToUserRecord(state.patientInfo.uid, state.patientInfo.phone, patientName);
                    var updatedPatientInfo = Object.assign({}, state.patientInfo, { name: patientName });
                    try {
                        yield asyncStorage.setItem('current-patient-info', JSON.stringify(updatedPatientInfo));
                    } catch (e) {}
                }

                var newToken = generateDisabledToken();
                if (patientName) {
                    newToken.patient.name = patientName;
                }
                
                // Firestore atomic transaction to prevent race conditions and duplicate positions
                yield (0, _firebase.runTransaction)(_firebase.db, /*#__PURE__*/function () {
                    var _tr = (0, _asyncToGenerator2.default)(function* (transaction) {
                        var queueRef = (0, _firebase.doc)(_firebase.db, 'queues', newToken.primaryDepartment);
                        var tokenRef = (0, _firebase.doc)(_firebase.db, 'tokens', newToken.id);
                        var queueSnap = yield transaction.get(queueRef);

                        var currentCount = 0;
                        if (queueSnap.exists()) {
                            currentCount = queueSnap.data().totalTokensToday || 0;
                        }
                        var nextCount = currentCount + 1;

                        transaction.set(tokenRef, Object.assign({}, newToken, {
                            timestamp: newToken.timestamp.toISOString(),
                            validUntil: newToken.validUntil ? newToken.validUntil.toISOString() : null,
                            createdAt: newToken.createdAt ? newToken.createdAt.toISOString() : new Date().toISOString(),
                            token_id: newToken.id,
                            patient_name: newToken.patient.name,
                            department: newToken.primaryDepartment,
                            doctor_id: formData.assignedDoctor || null,
                            status: 'waiting',
                            updatedAt: new Date().toISOString()
                        }));

                        transaction.set(queueRef, {
                            totalTokensToday: nextCount,
                            lastUpdated: new Date().toISOString()
                        }, { merge: true });
                    });
                    return function (_x) { return _tr.apply(this, arguments); };
                }());
                
=======

            try {
                var newToken = generateDisabledToken();

                // Insert into Supabase logic
                yield _supabaseClient.supabase.from('queue').insert([{
                    token_id: newToken.id,
                    patient_name: newToken.patient.name,
                    department: newToken.primaryDepartment,
                    doctor_id: formData.assignedDoctor || null, // Assuming no assigned doc explicitly defined in disability flow yet
                    status: 'waiting'
                }]);

>>>>>>> origin/main
                setState(function (prev) {
                    return Object.assign({},
                        prev, {
                        tokens: [].concat((0, _toConsumableArray2.default)(prev.tokens.filter(function(t) { return t.id !== newToken.id; })), [newToken]),
                        patientInfo: patientName ? Object.assign({}, prev.patientInfo, { name: patientName }) : prev.patientInfo,
                        currentToken: newToken,
                        currentView: 'token'
                    });
                });
            } catch (error) {
                console.error("Firestore Transaction Error (DisabledUserFlow):", error);
            }
        }); return function handleFormSubmit() { return _ref.apply(this, arguments); };
    }();

    if (!state.patientInfo) return null;

    var consultationDepartments = state.departments.filter(function (d) { return d.type === 'consultation'; });

    return (/*#__PURE__*/
        (0, _jsxRuntime.jsxs)(_reactNative.ScrollView, {
            contentContainerStyle: styles.container, children: [/*#__PURE__*/

                (0, _jsxRuntime.jsx)(_card.Card, {
                    style: [styles.cardSpacing, { borderColor: '#0ea5e9', borderWidth: 1 }], children:/*#__PURE__*/
                        (0, _jsxRuntime.jsxs)(_card.CardHeader, {
                            style: styles.rowBetween, children: [/*#__PURE__*/
                                (0, _jsxRuntime.jsxs)(_reactNative.View, {
                                    style: styles.row, children: [/*#__PURE__*/
                                        (0, _jsxRuntime.jsx)(_button.Button, {
                                            variant: "ghost", size: "sm", onPress: handleBack, style: { marginRight: 8 }, children:/*#__PURE__*/
                                                (0, _jsxRuntime.jsx)(_lucideReactNative.ArrowLeft, { size: 20, color: "#0ea5e9" })
                                        }
                                        ),/*#__PURE__*/
                                        (0, _jsxRuntime.jsxs)(_reactNative.View, {
                                            children: [/*#__PURE__*/
                                                (0, _jsxRuntime.jsx)(_card.CardTitle, { style: { color: '#0ea5e9' }, children: t('accTitle') }),/*#__PURE__*/
                                                (0, _jsxRuntime.jsx)(_reactNative.Text, { style: { color: '#0369a1', fontSize: 13, fontWeight: '500' }, children: t('accSubtitle') })]
                                        }
                                        )]
                                }
                                ),/*#__PURE__*/
                                (0, _jsxRuntime.jsx)(_lucideReactNative.Accessibility, { size: 28, color: "#0ea5e9" })]
                        }
                        )
                }
                ),/*#__PURE__*/

                (0, _jsxRuntime.jsx)(_card.Card, {
                    style: [styles.cardSpacing, { backgroundColor: '#f0fdfa', borderLeftWidth: 6, borderLeftColor: '#14b8a6' }], children:/*#__PURE__*/
                        (0, _jsxRuntime.jsxs)(_card.CardContent, {
                            style: { paddingTop: 0 }, children: [/*#__PURE__*/
                                (0, _jsxRuntime.jsx)(_reactNative.Text, { style: { fontWeight: '700', color: '#0f172a', marginBottom: 4 }, children: t('accComprehensiveSupport') }),/*#__PURE__*/
                                (0, _jsxRuntime.jsx)(_reactNative.Text, { style: { fontSize: 14, color: '#475569', lineHeight: 20 }, children: t('accComprehensiveSupportDesc') })]
                        }
                        )
                }
                ),/*#__PURE__*/

                (0, _jsxRuntime.jsx)(_card.Card, {
                    style: styles.cardSpacing, children:/*#__PURE__*/
                        (0, _jsxRuntime.jsxs)(_card.CardContent, {
                            style: { paddingTop: 16, gap: 16 }, children: [/*#__PURE__*/
                                (0, _jsxRuntime.jsx)(_reactNative.Text, { style: styles.sectionTitle, children: t('accMedicalInfo') }),/*#__PURE__*/

                                (0, _jsxRuntime.jsxs)(_reactNative.View, {
                                    children: [/*#__PURE__*/
                                        (0, _jsxRuntime.jsx)(_label.Label, { children: t('accName') }),/*#__PURE__*/
                                        (0, _jsxRuntime.jsx)(_input.Input, {
                                            value: formData.name,
                                            onChangeText: function onChangeText(val) { return setFormData(Object.assign({}, formData, { name: val })); },
                                            placeholder: "Enter patient name"
                                        })]
                                }),/*#__PURE__*/
                                (0, _jsxRuntime.jsxs)(_reactNative.View, {
                                    children: [/*#__PURE__*/
                                        (0, _jsxRuntime.jsx)(_label.Label, { children: t('accAge') }),/*#__PURE__*/
                                        (0, _jsxRuntime.jsx)(_input.Input, {
                                            keyboardType: "numeric",
                                            value: formData.age ? String(formData.age) : '',
                                            onChangeText: function onChangeText(val) { return setFormData(Object.assign({}, formData, { age: parseInt(val) || 0 })); }
                                        }
                                        )]
                                }
                                ),/*#__PURE__*/

                                (0, _jsxRuntime.jsxs)(_reactNative.View, {
                                    children: [/*#__PURE__*/
                                        (0, _jsxRuntime.jsx)(_label.Label, { children: t('accGender') }),/*#__PURE__*/
                                        (0, _jsxRuntime.jsx)(_reactNative.View, {
                                            style: styles.radioGroup, children:
                                                ['male', 'female', 'other'].map(function (option) {
                                                    var isSelected = formData.gender === option;
                                                    var RadioIcon = isSelected ? _lucideReactNative.CircleDot : _lucideReactNative.Circle;
                                                    var genderTranslate = option === 'male' ? t('emgMale') : option === 'female' ? t('emgFemale') : t('emgOther');
                                                    return (/*#__PURE__*/
                                                        (0, _jsxRuntime.jsxs)(_reactNative.TouchableOpacity, {
                                                            onPress: function onPress() { return setFormData(Object.assign({}, formData, { gender: option })); }, style: styles.radioOption, children: [/*#__PURE__*/
                                                                (0, _jsxRuntime.jsx)(RadioIcon, { size: 20, color: isSelected ? '#2563eb' : '#9ca3af' }),/*#__PURE__*/
                                                                (0, _jsxRuntime.jsx)(_reactNative.Text, { style: styles.radioText, children: genderTranslate })]
                                                        }, option
                                                        ));

                                                })
                                        }
                                        )]
                                }
                                ),/*#__PURE__*/

                                (0, _jsxRuntime.jsxs)(_reactNative.View, {
                                    children: [/*#__PURE__*/
                                        (0, _jsxRuntime.jsx)(_label.Label, { children: t('accPrimaryDepartment') }),/*#__PURE__*/
                                        (0, _jsxRuntime.jsxs)(_select.Select, {
                                            value: formData.primaryDepartment, onValueChange: function onValueChange(val) { return setFormData(Object.assign({}, formData, { primaryDepartment: val })); }, children: [/*#__PURE__*/
                                                (0, _jsxRuntime.jsx)(_select.SelectTrigger, {
                                                    style: { marginTop: 8 }, children:/*#__PURE__*/
                                                        (0, _jsxRuntime.jsx)(_select.SelectValue, { placeholder: t('accSelectDept') })
                                                }
                                                ),/*#__PURE__*/
                                                (0, _jsxRuntime.jsx)(_select.SelectContent, {
                                                    children:
                                                        consultationDepartments.map(function (dept) {
                                                            return (/*#__PURE__*/
                                                                (0, _jsxRuntime.jsx)(_select.SelectItem, {
                                                                    value: dept.name, children:/*#__PURE__*/
                                                                        (0, _jsxRuntime.jsx)(_reactNative.Text, { children: dept.name })
                                                                }, dept.name
                                                                ));
                                                        }
                                                        )
                                                }
                                                )]
                                        }
                                        )]
                                }
                                ),/*#__PURE__*/

                                (0, _jsxRuntime.jsx)(_reactNative.Text, { style: [styles.sectionTitle, { marginTop: 16 }], children: t('accAccessibilityInfo') }),/*#__PURE__*/

                                (0, _jsxRuntime.jsxs)(_reactNative.View, {
                                    children: [/*#__PURE__*/
                                        (0, _jsxRuntime.jsx)(_label.Label, { children: t('accTypeOfNeed') }),/*#__PURE__*/
                                        (0, _jsxRuntime.jsx)(_reactNative.View, {
                                            style: styles.grid, children:
                                                disabilityTypes.map(function (type) {
                                                    var Icon = type.icon;
                                                    var labelTranslate = t(disabilityTypeKeys[type.value]) || type.label;
                                                    return (/*#__PURE__*/
                                                        (0, _jsxRuntime.jsxs)(_reactNative.TouchableOpacity, {

                                                            style: [styles.typeBox, formData.disabilityType === type.value && styles.typeSelected],
                                                            onPress: function onPress() { return setFormData(Object.assign({}, formData, { disabilityType: type.value })); }, children: [/*#__PURE__*/

                                                                (0, _jsxRuntime.jsx)(Icon, { size: 16, color: formData.disabilityType === type.value ? '#2563eb' : '#4b5563' }),/*#__PURE__*/
                                                                (0, _jsxRuntime.jsx)(_reactNative.Text, { style: { marginLeft: 8, fontSize: 13, flexShrink: 1 }, children: labelTranslate })]
                                                        }, type.value
                                                        ));

                                                })
                                        }
                                        )]
                                }
                                ),/*#__PURE__*/

                                (0, _jsxRuntime.jsxs)(_reactNative.View, {
                                    children: [/*#__PURE__*/
                                        (0, _jsxRuntime.jsx)(_label.Label, { children: t('accAdditionalDetails') }),/*#__PURE__*/
                                        (0, _jsxRuntime.jsx)(_textarea.Textarea, {
                                            value: formData.disabilityDetails,
                                            onChangeText: function onChangeText(val) { return setFormData(Object.assign({}, formData, { disabilityDetails: val })); },
                                            placeholder: "Specific requirements...",
                                            style: { marginTop: 8 }
                                        }
                                        )]
                                }
                                ),/*#__PURE__*/

                                (0, _jsxRuntime.jsxs)(_reactNative.View, {
                                    children: [/*#__PURE__*/
                                        (0, _jsxRuntime.jsx)(_label.Label, { children: t('accPriorityLevel') }),/*#__PURE__*/
                                        (0, _jsxRuntime.jsx)(_reactNative.View, {
                                            style: styles.radioGroup, children:
                                                [
                                                    { value: 'normal', label: t('accStandardPriority') },
                                                    { value: 'priority', label: t('accHighPriority') }].
                                                    map(function (option) {
                                                        var isSelected = formData.urgency === option.value;
                                                        var RadioIcon = isSelected ? _lucideReactNative.CircleDot : _lucideReactNative.Circle;
                                                        return (/*#__PURE__*/
                                                            (0, _jsxRuntime.jsxs)(_reactNative.TouchableOpacity, {
                                                                onPress: function onPress() { return setFormData(Object.assign({}, formData, { urgency: option.value })); }, style: styles.radioOption, children: [/*#__PURE__*/
                                                                    (0, _jsxRuntime.jsx)(RadioIcon, { size: 20, color: isSelected ? '#2563eb' : '#9ca3af' }),/*#__PURE__*/
                                                                    (0, _jsxRuntime.jsx)(_reactNative.Text, { style: styles.radioText, children: option.label })]
                                                            }, option.value
                                                            ));

                                                    })
                                        }
                                        )]
                                }
                                ),/*#__PURE__*/

                                (0, _jsxRuntime.jsx)(_reactNative.Text, { style: [styles.sectionTitle, { marginTop: 16 }], children: t('accSupportServicesRequired') }),/*#__PURE__*/


                                (0, _jsxRuntime.jsxs)(_reactNative.View, {
                                    children: [
                                        assistanceOptions.map(function (opt) {
                                            return (/*#__PURE__*/
                                                (0, _jsxRuntime.jsxs)(_reactNative.View, {
                                                    style: [styles.row, { marginBottom: 8 }], children: [/*#__PURE__*/
                                                        (0, _jsxRuntime.jsx)(_checkbox.Checkbox, {
                                                            checked: formData.assistanceNeeded.includes(opt),
                                                            onCheckedChange: function onCheckedChange(checked) { return handleAssistanceChange(opt, !!checked); }
                                                        }
                                                        ),/*#__PURE__*/
                                                        (0, _jsxRuntime.jsx)(_reactNative.Text, { style: { marginLeft: 8 }, children: t(assistanceOptionKeys[opt]) || opt })]
                                                }, opt
                                                ));
                                        }
                                        ),/*#__PURE__*/
                                        (0, _jsxRuntime.jsxs)(_reactNative.View, {
                                            style: styles.row, children: [/*#__PURE__*/
                                                (0, _jsxRuntime.jsx)(_checkbox.Checkbox, {
                                                    checked: formData.otherAssistance.trim() !== '',
                                                    onCheckedChange: function onCheckedChange(checked) {
                                                        if (!checked) setFormData(Object.assign({}, formData, { otherAssistance: '' }));
                                                    }
                                                }
                                                ),/*#__PURE__*/
                                                (0, _jsxRuntime.jsx)(_reactNative.Text, { style: { marginLeft: 8 }, children: t('accOther') })]
                                        }
                                        ),
                                        formData.otherAssistance.trim() !== '' &&/*#__PURE__*/
                                        (0, _jsxRuntime.jsx)(_input.Input, {
                                            value: formData.otherAssistance,
                                            onChangeText: function onChangeText(val) { return setFormData(Object.assign({}, formData, { otherAssistance: val })); },
                                            placeholder: t('accSpecifyAssistance'),
                                            style: { marginTop: 8, marginLeft: 32 }
                                        }
                                        )]
                                }

                                ),/*#__PURE__*/

                                (0, _jsxRuntime.jsx)(_reactNative.Text, { style: [styles.sectionTitle, { marginTop: 16 }], children: t('accCaregiverInfo') }),/*#__PURE__*/
                                (0, _jsxRuntime.jsx)(_input.Input, {
                                    placeholder: t('accCaregiverName'),
                                    value: formData.caregiverName,
                                    onChangeText: function onChangeText(val) { return setFormData(Object.assign({}, formData, { caregiverName: val })); }
                                }
                                ),/*#__PURE__*/
                                (0, _jsxRuntime.jsx)(_input.Input, {
                                    placeholder: t('accCaregiverPhone'),
                                    keyboardType: "phone-pad",
                                    value: formData.caregiverPhone,
                                    onChangeText: function onChangeText(val) { return setFormData(Object.assign({}, formData, { caregiverPhone: val })); }
                                }
                                ),/*#__PURE__*/

                                (0, _jsxRuntime.jsx)(_button.Button, {
                                    onPress: handleFormSubmit, style: { marginTop: 16 }, children:/*#__PURE__*/
                                        (0, _jsxRuntime.jsx)(_reactNative.Text, { style: { color: '#fff', fontWeight: 'bold' }, children: t('accGenerateToken') })
                                }
                                )]
                        }
                        )
                }
                )]
        }
        ));

}

var styles = _reactNative.StyleSheet.create({
    container: { padding: 24, paddingBottom: 40, backgroundColor: '#f0fdfa', flexGrow: 1 },// minty background, more padding
    cardSpacing: { marginBottom: 20 },
    row: { flexDirection: 'row', alignItems: 'center' },
    rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    sectionTitle: { fontSize: 18, fontWeight: '700', borderBottomWidth: 1, borderBottomColor: '#e0f2fe', paddingBottom: 8, color: '#0f172a' },// softer border, darker text
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 12 },
    formGroup: { marginBottom: 16 },
    label: { fontSize: 14, fontWeight: '500', color: '#0ea5e9' },// teal label
    typeBox: { padding: 16, borderWidth: 1, borderColor: '#e0f2fe', borderRadius: 16, width: '48%', flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff' },// larger radius, white bg
    typeSelected: { borderColor: '#0ea5e9', backgroundColor: '#f0fdfa', borderWidth: 2 },// minty selection, teal border
    radioGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 20, marginTop: 12 },
    radioOption: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    radioText: { fontSize: 16, color: '#475569', fontWeight: '500' }// softer gray
});

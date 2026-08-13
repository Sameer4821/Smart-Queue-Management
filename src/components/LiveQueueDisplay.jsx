var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", { value: true });
exports.LiveQueueDisplay = LiveQueueDisplay;
var _slicedToArray2 = _interopRequireDefault(require("@babel/runtime/helpers/slicedToArray"));
var _react = _interopRequireWildcard(require("react"));
var _reactNative = require("react-native");
var _AppContext = require("../context/AppContext");
var _lucideReactNative = require("lucide-react-native");
var _useTranslation = require("../hooks/useTranslation");
var _jsxRuntime = require("react/jsx-runtime");

function _interopRequireWildcard(e) {
    if ("function" == typeof WeakMap) {
        var r = new WeakMap(), n = new WeakMap();
        return (_interopRequireWildcard = function _interopRequireWildcard(e) {
            if (e && e.__esModule) return e;
            var o = {};
            if (null != e) {
                for (var t in e) {
                    if (Object.prototype.hasOwnProperty.call(e, t)) {
                        var i = Object.defineProperty && Object.getOwnPropertyDescriptor ? Object.getOwnPropertyDescriptor(e, t) : {};
                        if (i.get || i.set) Object.defineProperty(o, t, i);
                        else o[t] = e[t];
                    }
                }
            }
            return o.default = e, o;
        })(e);
    }
    return e;
}

var priorityMap = {
    emergency: 1,
    disabled: 2,
    common: 3
};

function LiveQueueDisplay(_ref) {
    var onBack = _ref.onBack;
    var _useAppContext = (0, _AppContext.useAppContext)(), state = _useAppContext.state;
    var t = (0, _useTranslation.useTranslation)().t;
    var _useState = (0, _react.useState)(new Date()), _useState2 = (0, _slicedToArray2.default)(_useState, 2), lastUpdated = _useState2[0], setLastUpdated = _useState2[1];

    (0, _react.useEffect)(function () {
        var timer = setInterval(function () {
            setLastUpdated(new Date());
        }, 30000);
        return function () { return clearInterval(timer); };
    }, []);

    const formatTokenId = function (id) {
        if (!id) return "---";
        var parts = id.split("-");
        var base = parts.length > 2 ? parts[2] : id;
        if (base.length > 4) base = base.substring(0, 4);
        return base;
    };

    const getDeptAccent = function (type) {
        if (type === "diagnostic") return "#f59e0b";
        if (type === "pharmacy") return "#8b5cf6";
        if (type === "administrative") return "#64748b";
        return "#2563eb"; // consultation / default
    };

    const formatTime = function (date) {
        var h = date.getHours().toString().padStart(2, "0");
        var m = date.getMinutes().toString().padStart(2, "0");
        return `${h}:${m}`;
    };

    // Filter and sort active/waiting tokens
    var allActiveTokens = (state.tokens || []).filter(function (tok) {
        return tok.status === "active" || tok.status === "waiting";
    }).sort(function (a, b) {
        return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    });

    // Build deptName -> { dept, tokens } map
    var buildLiveQueueMap = function () {
        var map = {};

        // Seed from department list
        (state.departments || []).forEach(function (dept) {
            map[dept.name] = { dept: dept, tokens: [] };
        });

        // Populate with live tokens
        allActiveTokens.forEach(function (tok) {
            var key = tok.primaryDepartment;
            if (!key) return;
            if (!map[key]) map[key] = { dept: null, tokens: [] };
            map[key].tokens.push(tok);
        });

        // Filter: Keep active departments (tokens > 0 or currentQueue > 0)
        return Object.entries(map).filter(function (_ref2) {
            var val = _ref2[1];
            var hasLiveTokens = val.tokens.length > 0;
            var hasStaticQueue = val.dept && val.dept.currentQueue > 0;
            return hasLiveTokens || hasStaticQueue;
        });
    };

    var liveRows = buildLiveQueueMap();

    return (/*#__PURE__*/
        (0, _jsxRuntime.jsxs)(_reactNative.SafeAreaView, {
            style: styles.container, children: [/*#__PURE__*/
                (0, _jsxRuntime.jsxs)(_reactNative.View, {
                    style: styles.header, children: [/*#__PURE__*/
                        (0, _jsxRuntime.jsx)(_reactNative.TouchableOpacity, {
                            onPress: onBack, style: styles.backBtn, children:/*#__PURE__*/
                                (0, _jsxRuntime.jsx)(_lucideReactNative.ArrowLeft, { size: 24, color: "#1e293b" })
                        }),/*#__PURE__*/
                        (0, _jsxRuntime.jsxs)(_reactNative.View, {
                            style: styles.headerInfo, children: [/*#__PURE__*/
                                (0, _jsxRuntime.jsx)(_reactNative.Text, { style: styles.headerTitle, children: "Live Queue" }),/*#__PURE__*/
                                (0, _jsxRuntime.jsx)(_reactNative.Text, { style: styles.headerSubtitle, children: "Real-time updates" })]
                        })]
                }),/*#__PURE__*/
                (0, _jsxRuntime.jsxs)(_reactNative.ScrollView, {
                    contentContainerStyle: styles.scrollContent, showsVerticalScrollIndicator: false, children: [/*#__PURE__*/
                        (0, _jsxRuntime.jsxs)(_reactNative.View, {
                            style: styles.liveHeaderRow, children: [/*#__PURE__*/
                                (0, _jsxRuntime.jsxs)(_reactNative.View, {
                                    children: [/*#__PURE__*/
                                        (0, _jsxRuntime.jsx)(_reactNative.Text, { style: styles.liveTitle, children: "Live Queue Display" }),/*#__PURE__*/
                                        (0, _jsxRuntime.jsxs)(_reactNative.Text, { style: styles.liveSubtitle, children: [liveRows.length, " department", liveRows.length !== 1 ? 's' : '', " active"] })]
                                }),/*#__PURE__*/
                                (0, _jsxRuntime.jsx)(_reactNative.View, {
                                    style: styles.liveUpdatedBadge, children:/*#__PURE__*/
                                        (0, _jsxRuntime.jsxs)(_reactNative.Text, { style: styles.liveUpdatedText, children: ["Updated ", formatTime(lastUpdated)] })
                                })]
                        }),
                        liveRows.length === 0 ? (/*#__PURE__*/
                            (0, _jsxRuntime.jsxs)(_reactNative.View, {
                                style: styles.liveEmptyState, children: [/*#__PURE__*/
                                    (0, _jsxRuntime.jsx)(_lucideReactNative.Monitor, { size: 52, color: "#cbd5e1" }),/*#__PURE__*/
                                    (0, _jsxRuntime.jsx)(_reactNative.Text, { style: styles.liveEmptyTitle, children: "No Active Queues" }),/*#__PURE__*/
                                    (0, _jsxRuntime.jsx)(_reactNative.Text, { style: styles.liveEmptySub, children: "All departments are currently idle." })]
                            })
                        ) : (
                            liveRows.map(function (_ref3) {
                                var deptName = _ref3[0], val = _ref3[1];
                                var dept = val.dept, dTokens = val.tokens;
                                var accent = getDeptAccent(dept ? dept.type : null);

                                // Sort tokens by priority then timestamp
                                var sorted = (0, _toConsumableArray)(dTokens).sort(function (a, b) {
                                    var pA = priorityMap[a.type] || 3;
                                    var pB = priorityMap[b.type] || 3;
                                    if (pA !== pB) return pA - pB;
                                    return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
                                });

                                var nowServingToken = sorted[0];
                                var nextToken = sorted[1];

                                var availDoc = dept ? dept.doctors.find(function (d) { return d.status === 'available'; }) : null;
                                var counterLabel = availDoc
                                    ? `Counter ${(dept.doctors.indexOf(availDoc) + 1)}`
                                    : 'Counter 01';

                                var isActive = dTokens.length > 0 || (dept ? dept.currentQueue : 0) > 0;

                                return (/*#__PURE__*/
                                    (0, _jsxRuntime.jsxs)(_reactNative.View, {
                                        style: styles.liveCard, children: [/*#__PURE__*/
                                            (0, _jsxRuntime.jsx)(_reactNative.View, { style: [styles.liveAccentBar, { backgroundColor: accent }] }),/*#__PURE__*/
                                            (0, _jsxRuntime.jsxs)(_reactNative.View, {
                                                style: styles.liveCardBody, children: [/*#__PURE__*/
                                                    (0, _jsxRuntime.jsx)(_reactNative.Text, { style: styles.liveDeptName, numberOfLines: 1, children: deptName }),/*#__PURE__*/
                                                    (0, _jsxRuntime.jsxs)(_reactNative.View, {
                                                        style: styles.liveInfoRow, children: [/*#__PURE__*/
                                                            (0, _jsxRuntime.jsxs)(_reactNative.View, {
                                                                style: styles.liveInfoCell, children: [/*#__PURE__*/
                                                                    (0, _jsxRuntime.jsx)(_reactNative.Text, { style: styles.liveInfoLabel, children: "Now Serving" }),/*#__PURE__*/
                                                                    (0, _jsxRuntime.jsx)(_reactNative.Text, { style: [styles.liveInfoValue, { color: accent }], children: nowServingToken ? formatTokenId(nowServingToken.id) : '---' })]
                                                            }),/*#__PURE__*/
                                                            (0, _jsxRuntime.jsx)(_reactNative.View, { style: styles.liveDivider }),/*#__PURE__*/
                                                            (0, _jsxRuntime.jsxs)(_reactNative.View, {
                                                                style: styles.liveInfoCell, children: [/*#__PURE__*/
                                                                    (0, _jsxRuntime.jsx)(_reactNative.Text, { style: styles.liveInfoLabel, children: "Next" }),/*#__PURE__*/
                                                                    (0, _jsxRuntime.jsx)(_reactNative.Text, { style: styles.liveInfoValue, children: nextToken ? formatTokenId(nextToken.id) : '---' })]
                                                            }),/*#__PURE__*/
                                                            (0, _jsxRuntime.jsx)(_reactNative.View, { style: styles.liveDivider }),/*#__PURE__*/
                                                            (0, _jsxRuntime.jsxs)(_reactNative.View, {
                                                                style: styles.liveInfoCell, children: [/*#__PURE__*/
                                                                    (0, _jsxRuntime.jsx)(_reactNative.Text, { style: styles.liveInfoLabel, children: "Counter" }),/*#__PURE__*/
                                                                    (0, _jsxRuntime.jsx)(_reactNative.Text, { style: styles.liveInfoValue, children: counterLabel })]
                                                            }),/*#__PURE__*/
                                                            (0, _jsxRuntime.jsx)(_reactNative.View, { style: styles.liveDivider }),/*#__PURE__*/
                                                            (0, _jsxRuntime.jsxs)(_reactNative.View, {
                                                                style: [styles.liveStatusBadge, isActive ? styles.liveStatusActive : styles.liveStatusPaused], children: [/*#__PURE__*/
                                                                    (0, _jsxRuntime.jsx)(_reactNative.Text, { style: styles.liveStatusDot, children: isActive ? '🟢' : '🟡' }),/*#__PURE__*/
                                                                    (0, _jsxRuntime.jsx)(_reactNative.Text, { style: [styles.liveStatusText, { color: isActive ? '#16a34a' : '#d97706' }], children: isActive ? 'Active' : 'Paused' })]
                                                            })]
                                                    }),/*#__PURE__*/
                                                    (0, _jsxRuntime.jsx)(_reactNative.Text, {
                                                        style: styles.liveQueueCount, children: dTokens.length > 0
                                                            ? `${dTokens.length} patient${dTokens.length !== 1 ? 's' : ''} in queue`
                                                            : `${(dept ? dept.currentQueue : 0)} in queue`
                                                    })]
                                            })]
                                    }, deptName
                                    ));
                            })
                        )]
                })]
        }
        ));
}

function _toConsumableArray(arr) {
    if (Array.isArray(arr)) {
        for (var i = 0, arr2 = new Array(arr.length); i < arr.length; i++) arr2[i] = arr[i];
        return arr2;
    }
    return Array.from(arr);
}

var styles = _reactNative.StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f9fafb' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#ffffff',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9'
    },
    backBtn: {
        padding: 4,
        marginRight: 12
    },
    headerInfo: {
        flex: 1
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1e293b'
    },
    headerSubtitle: {
        fontSize: 12,
        color: '#64748b'
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 32
    },
    liveHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16
    },
    liveTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#0f172a'
    },
    liveSubtitle: {
        fontSize: 13,
        color: '#64748b',
        marginTop: 2
    },
    liveUpdatedBadge: {
        backgroundColor: '#f1f5f9',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 20
    },
    liveUpdatedText: {
        fontSize: 11,
        color: '#475569',
        fontWeight: '600'
    },
    liveEmptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
        backgroundColor: '#ffffff',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0'
    },
    liveEmptyTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#334155',
        marginTop: 16,
        marginBottom: 6
    },
    liveEmptySub: {
        fontSize: 14,
        color: '#94a3b8',
        textAlign: 'center'
    },
    liveCard: {
        flexDirection: 'row',
        backgroundColor: '#ffffff',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginBottom: 10,
        overflow: 'hidden',
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 3
    },
    liveAccentBar: {
        width: 5
    },
    liveCardBody: {
        flex: 1,
        padding: 14
    },
    liveDeptName: {
        fontSize: 15,
        fontWeight: '800',
        color: '#0f172a',
        marginBottom: 10
    },
    liveInfoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        borderRadius: 10,
        paddingVertical: 10,
        paddingHorizontal: 8,
        marginBottom: 8
    },
    liveInfoCell: {
        flex: 1,
        alignItems: 'center'
    },
    liveInfoLabel: {
        fontSize: 10,
        color: '#94a3b8',
        fontWeight: '700',
        letterSpacing: 0.5,
        marginBottom: 3,
        textTransform: 'uppercase'
    },
    liveInfoValue: {
        fontSize: 16,
        fontWeight: '900',
        color: '#0f172a'
    },
    liveDivider: {
        width: 1,
        height: 36,
        backgroundColor: '#e2e8f0',
        marginHorizontal: 4
    },
    liveStatusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingHorizontal: 8,
        paddingVertical: 5,
        borderRadius: 8
    },
    liveStatusActive: {
        backgroundColor: '#f0fdf4'
    },
    liveStatusPaused: {
        backgroundColor: '#fffbeb'
    },
    liveStatusDot: {
        fontSize: 10
    },
    liveStatusText: {
        fontSize: 11,
        fontWeight: '700'
    },
    liveQueueCount: {
        fontSize: 12,
        color: '#94a3b8',
        fontWeight: '500'
    }
});

export const environment = {
    production: false,
    useEmulators: true,
    firebase: {
        projectId: 'angulogin-com',
        appId: '1:206038392526:web:a3a11143f93f96ced5ba9f',
        storageBucket: 'angulogin-com.firebasestorage.app',
        apiKey: 'AIzaSyAiGkUU2Hp3Z9GNVoCym1bjX6Pt1tdX_4c',
        authDomain: 'angulogin-com.firebaseapp.com',
        messagingSenderId: '206038392526',
        measurementId: 'G-WLLVN5J7JR',
        googleClientId: '206038392526-3luktmt5vhgv1sfaeekrhb81p75kbphf.apps.googleusercontent.com',
    },
    emulators: {
        auth: 9099,
        firestore: 8080,
        functions: 5001,
        storage: 9199
    },
    // LemonSqueezy checkout URLs (fill after creating LS store products)
    lemonSqueezy: {
        starter: '' as string,
        pro: '' as string,
        team: '' as string,
    } as Record<string, string>,
};

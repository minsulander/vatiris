import axios, { type AxiosResponse } from "axios"
import moment from "moment"
import { defineStore } from "pinia"
import { ref } from "vue"

const clientId = import.meta.env.VITE_CLIENT_ID || "682"
const redirectUri = import.meta.env.VITE_REDIRECT_URI || "http://localhost:5173/login"
const vatsimAuthBaseUri = import.meta.env.VITE_VATSIM_AUTH_BASE_URI || "https://auth-dev.vatsim.net"
const backendBaseUrl = import.meta.env.VITE_BACKEND_BASE_URL || "http://localhost:5172"

export const useAuthStore = defineStore("auth", () => {
    console.log("hello auth")

    const pending = ref(true)
    const token = ref({} as any)
    const user = ref(undefined as any)

    if (sessionStorage.authorizationCode) {
        console.log(`${backendBaseUrl}/token?code=${sessionStorage.authorizationCode}`)
        axios
            .get(`${backendBaseUrl}/token?code=${sessionStorage.authorizationCode}`)
            .then((response) => {
                receiveToken(response)
            })
            .catch((error) => {
                console.error("Failed to get token from authorization code", error)
                pending.value = false
            })
    } else if (localStorage.token) {
        if (
            !localStorage.tokenTimestamp ||
            moment().isBefore(
                moment(localStorage.tokenTimestamp).add(token.value.expires_in - 60, "second"),
            )
        ) {
            console.log("Refreshing token")
            const expiredToken = JSON.parse(localStorage.token)
            axios
                .get(`${backendBaseUrl}/token?refresh_token=${expiredToken.refresh_token}`)
                .then((response) => {
                    receiveToken(response)
                })
                .catch((error) => {
                    console.error("Failed to get token from refresh token", error)
                    pending.value = false
                })
        } else {
            token.value = JSON.parse(localStorage.token)
            fetchUser()
        }
    } else {
        pending.value = false
    }

    function receiveToken(response: AxiosResponse) {
        token.value = response.data
        localStorage.token = JSON.stringify(response.data)
        localStorage.tokenTimestamp = moment().toISOString()
        delete sessionStorage.authorizationCode
        fetchUser()
    }

    function fetchUser() {
        axios
            .get(`${vatsimAuthBaseUri}/api/user`, {
                headers: { Authorization: `Bearer ${token.value.access_token}` },
            })
            .then((response) => {
                console.log(response.data.data)
                user.value = response.data.data
                pending.value = false
                axios.post(`${backendBaseUrl}/login`, user.value).then((response) => {
                    console.log(response.data)
                }).catch((error) => {
                    console.error("Failed to login user", error)
                })
            })
            .catch((error) => {
                console.error("Failed to get user from token", error)
                pending.value = false
            })
    }

    function login() {
        location.href =
            `${vatsimAuthBaseUri}/oauth/authorize` +
            `?response_type=code&client_id=${encodeURIComponent(clientId)}` +
            `&redirect_uri=${encodeURIComponent(redirectUri)}` +
            `&scope=full_name%20vatsim_details%20country` +
            `&prompt=login`
    }

    function logout() {
        delete sessionStorage.authorizationCode
        delete localStorage.token
        delete localStorage.tokenTimestamp
        token.value = {}
        user.value = undefined
    }

    return { pending, user, login, logout }
})

import axios, { type AxiosResponse } from "axios"
import moment from "moment"
import { defineStore } from "pinia"
import { ref } from "vue"

const clientId = "682"
const redirectUri = "http://localhost:5173/login"
const vatsimAuthBaseUri = "https://auth-dev.vatsim.net"
const backendBaseUrl =
    location.hostname == "localhost" || location.hostname == "127.0.0.1"
        ? "http://localhost:5172"
        : "https://api.vatiris.se"

export const useAuthStore = defineStore("auth", () => {
    console.log("hello auth")

    const pending = ref(true)
    const token = ref({} as any)
    const user = ref(undefined as any)

    if (sessionStorage.authorizationCode) {
        console.log(
            "oh look we have an authorization code",
            `${backendBaseUrl}/token?code=${sessionStorage.authorizationCode}`,
        )
        axios
            .get(`${backendBaseUrl}/token?code=${sessionStorage.authorizationCode}`)
            .then((response) => {
                console.log("oh look we got a token")
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
            console.log("oh look we have a token but it's expired")
            const expiredToken = JSON.parse(localStorage.token)
            axios
                .get(`${backendBaseUrl}/token?refresh_token=${expiredToken.refresh_token}`)
                .then((response) => {
                    console.log("oh look we got a refreshed token")
                    receiveToken(response)
                })
                .catch((error) => {
                    console.error("Failed to get token from refresh token", error)
                    pending.value = false
                })
        } else {
            console.log("oh look we have a token")
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
                console.log("oh look we got a user")
                console.log(response.data.data)
                user.value = response.data.data
                pending.value = false
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
            `&scope=vatsim_details%20country` +
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

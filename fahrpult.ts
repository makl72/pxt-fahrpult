/**
 * BOT / CTRL Fahrpult: Kommunikation, Sitzung und Zeitueberwachung.
 * Eigene Bloecke ersetzen nur die gewaehlte Aktion. Ein Stopp setzt die
 * Motoren immer direkt auf null, unabhaengig von Schueler-Ereignissen.
 */
//% color="#568719" weight=100 icon="\uf11b" block="Fahrpult"
//% groups='["Eigene Aktionen", "Motoren", "Servo und Sensor", "Einrichtung"]'
namespace fahrpult {
    export enum Schalter {
        //% block="1 (P2)"
        Eins = 1,
        //% block="2 (P16)"
        Zwei = 2
    }
    export enum Zustand {
        //% block="EIN"
        Ein = 1,
        //% block="AUS"
        Aus = 0
    }

    let gestartet = false
    let bereit = false
    let sitzung = ""
    let letzteNummer = 0
    let letzterFahrbefehl = 0
    let fahrfreigabe = false
    let empfangenLinks = 0
    let empfangenRechts = 0
    let motorLinks = 0
    let motorRechts = 0
    let winkel = 90
    let aktion1 = 0
    let aktion2 = 0
    let statuskanal = "mein-roboter/status"
    let fahrHandler: (links: number, rechts: number) => void = null
    let servoHandler: (winkel: number) => void = null
    let schalterHandler: (() => void)[] = [null, null, null, null]
    const STOPP_EVENT = 9241

    function ganzeZahl(text: string, min: number, max: number): boolean {
        const n = parseInt(text)
        return text == "" + n && n >= min && n <= max
    }
    function begrenzen(wert: number, min: number, max: number): number {
        if (wert != wert) return min
        return Math.round(Math.max(min, Math.min(max, wert)))
    }
    function ausgabe(links: number, rechts: number): void {
        motorLinks = links
        motorRechts = rechts
        if (links == 0) motor.motorStop(motor.Motors.M1)
        else motor.MotorRun(motor.Motors.M1, links > 0 ? motor.Dir.CW : motor.Dir.CCW, Math.round(Math.abs(links) * 255 / 100))
        if (rechts == 0) motor.motorStop(motor.Motors.M2)
        else motor.MotorRun(motor.Motors.M2, rechts > 0 ? motor.Dir.CW : motor.Dir.CCW, Math.round(Math.abs(rechts) * 255 / 100))
    }
    function ausgang(schalter: number, zustand: number): void {
        if (schalter == 1) pins.digitalWritePin(DigitalPin.P2, zustand)
        else if (schalter == 2) pins.digitalWritePin(DigitalPin.P16, zustand)
    }
    function schalterSetzen(schalter: number, zustand: number): void {
        if (schalter == 1) aktion1 = zustand
        else aktion2 = zustand
        const handler = schalterHandler[(schalter - 1) * 2 + zustand]
        if (handler) handler()
        else ausgang(schalter, zustand)
    }
    function stoppen(melden: boolean): void {
        const warAktiv = fahrfreigabe || motorLinks != 0 || motorRechts != 0
        fahrfreigabe = false
        empfangenLinks = 0
        empfangenRechts = 0
        ausgabe(0, 0)
        if (melden && warAktiv) control.raiseEvent(STOPP_EVENT, 1)
    }
    function neueSitzung(): void {
        stoppen(true)
        letzteNummer = 0
        sitzung = "" + randint(10000000, 99999999)
        // Eigene AUS-Aktionen ausloesen; die beiden Standardausgaenge immer aus.
        const a1 = aktion1
        const a2 = aktion2
        aktion1 = 0
        aktion2 = 0
        ausgang(1, 0)
        ausgang(2, 0)
        if (a1 && schalterHandler[0]) schalterHandler[0]()
        if (a2 && schalterHandler[2]) schalterHandler[2]()
    }
    function befehl(nachricht: string): void {
        if (!bereit) return
        if (nachricht == "H") {
            neueSitzung()
            return
        }
        const teile = nachricht.split("|")
        if (teile.length < 4 || teile[1] != sitzung || !ganzeZahl(teile[2], 1, 2000000000)) return
        const nummer = parseInt(teile[2])
        if (nummer <= letzteNummer) return
        if (teile[0] == "D" && teile.length == 5 && ganzeZahl(teile[3], -100, 100) && ganzeZahl(teile[4], -100, 100)) {
            letzteNummer = nummer
            const links = parseInt(teile[3])
            const rechts = parseInt(teile[4])
            if (links == 0 && rechts == 0) {
                stoppen(true)
                return
            }
            empfangenLinks = links
            empfangenRechts = rechts
            letzterFahrbefehl = input.runningTime()
            fahrfreigabe = true
            if (fahrHandler) fahrHandler(links, rechts)
            else motoren(links, rechts)
        } else if (teile[0] == "A" && teile.length == 5 && ganzeZahl(teile[3], 1, 2) && ganzeZahl(teile[4], 0, 1)) {
            letzteNummer = nummer
            schalterSetzen(parseInt(teile[3]), parseInt(teile[4]))
        } else if (teile[0] == "S" && teile.length == 4 && ganzeZahl(teile[3], 0, 180)) {
            letzteNummer = nummer
            const soll = parseInt(teile[3])
            if (servoHandler) servoHandler(soll)
            else servo(soll)
        }
    }

    /** Eigene Aktion fuer einen Schalter. Ohne diesen Block wird P2 bzw. P16 geschaltet. */
    //% blockId=fahrpult_on_switch block="wenn Schalter $schalter $zustand"
    //% group="Eigene Aktionen" weight=100
    export function wennSchalter(schalter: Schalter, zustand: Zustand, handler: () => void): void {
        if ((schalter == 1 || schalter == 2) && (zustand == 0 || zustand == 1))
            schalterHandler[(schalter - 1) * 2 + zustand] = handler
    }
    /** Ersetzt die automatische Motorsteuerung. Befehl kommt beim Halten etwa alle 150 ms. Keine langen Pausen verwenden. */
    //% blockId=fahrpult_on_drive block="wenn Fahrbefehl empfangen"
    //% draggableParameters group="Eigene Aktionen" weight=95
    export function wennFahrbefehl(handler: (links: number, rechts: number) => void): void {
        fahrHandler = handler
    }
    /** Motoren sind schon gestoppt. Eigene Zusatzaktion, z.B. ein Symbol, anhaengen. */
    //% blockId=fahrpult_on_stop block="wenn Fahrt gestoppt"
    //% group="Eigene Aktionen" weight=90
    export function wennStopp(handler: () => void): void {
        control.onEvent(STOPP_EVENT, 1, handler)
    }
    /** Ersetzt die automatische Servoaktion. Mit "Servo auf ... Grad" eine eigene Umsetzung festlegen. */
    //% blockId=fahrpult_on_servo block="wenn Servo-Winkel empfangen"
    //% draggableParameters group="Eigene Aktionen" weight=85
    export function wennServo(handler: (winkel: number) => void): void {
        servoHandler = handler
    }
    /** Negative Werte fahren rueckwaerts. Freigabe nur innerhalb von 600 ms nach gueltigem Fahrbefehl. */
    //% blockId=fahrpult_motors block="Motor links $links % rechts $rechts %"
    //% links.min=-100 links.max=100 links.defl=50 rechts.min=-100 rechts.max=100 rechts.defl=50
    //% group="Motoren" weight=80
    export function motoren(links: number, rechts: number): void {
        if (!bereit || !fahrfreigabe || input.runningTime() - letzterFahrbefehl >= 600) {
            stoppen(true)
            return
        }
        ausgabe(begrenzen(links, -100, 100), begrenzen(rechts, -100, 100))
    }
    /** Stoppt die Motoren sofort. Der naechste neue Fahrbefehl darf wieder fahren. */
    //% blockId=fahrpult_stop block="Motoren stoppen"
    //% group="Motoren" weight=75
    export function stopp(): void {
        stoppen(true)
    }
    /** Schaltet den Standardausgang fuer diese Aktion: Schalter 1 an P2, Schalter 2 an P16. */
    //% blockId=fahrpult_switch_output block="Ausgang von Schalter $schalter auf $zustand"
    //% group="Eigene Aktionen" weight=70
    export function schaltausgang(schalter: Schalter, zustand: Zustand): void {
        ausgang(schalter, zustand == Zustand.Ein ? 1 : 0)
    }
    /** Stellt den Positionsservo am DFRobot-Anschluss S1 ein. */
    //% blockId=fahrpult_servo block="Servo auf $grad Grad"
    //% grad.min=0 grad.max=180 grad.defl=90 group="Servo und Sensor" weight=65
    export function servo(grad: number): void {
        winkel = begrenzen(grad, 0, 180)
        motor.servo(motor.Servos.S1, winkel)
    }
    /** Rohwert des analogen Sensors an IoT:bit P1, zwischen 0 und 1023. */
    //% blockId=fahrpult_sensor block="analoger Sensorwert (P1)"
    //% group="Servo und Sensor" weight=60
    export function sensorwert(): number {
        return pins.analogReadPin(AnalogPin.P1)
    }
    /** Wahr, sobald WLAN und MQTT verbunden sind. Die App muss zusaetzlich Telemetrie erhalten. */
    //% blockId=fahrpult_ready block="Fahrpult verbunden"
    //% group="Einrichtung" weight=50
    export function verbunden(): boolean {
        return bereit
    }
    /** Einmal einrichten. Im erzeugten Schuelerprojekt uebernimmt verbindung.ts diesen Aufruf ausserhalb der Blockflaeche. */
    //% blockId=fahrpult_connect block="Fahrpult einrichten WLAN $wlan Passwort $wlanPasswort||MQTT-Host $host Benutzer $benutzer MQTT-Passwort $mqttPasswort Befehlskanal $befehlskanal Statuskanal $rueckkanal"
    //% expandableArgumentMode="toggle" inlineInputMode="external"
    //% wlan.defl="WLAN_NAME_EINTRAGEN" wlanPasswort.defl="WLAN_PASSWORT_EINTRAGEN"
    //% host.defl="MQTT_HOST_EINTRAGEN" benutzer.defl="MQTT_BENUTZER_EINTRAGEN" mqttPasswort.defl="MQTT_PASSWORT_EINTRAGEN"
    //% befehlskanal.defl="mein-roboter/befehl" rueckkanal.defl="mein-roboter/status"
    //% group="Einrichtung" weight=40 advanced=true
    export function verbinden(wlan: string, wlanPasswort: string, host: string = "MQTT_HOST_EINTRAGEN", benutzer: string = "MQTT_BENUTZER_EINTRAGEN", mqttPasswort: string = "MQTT_PASSWORT_EINTRAGEN", befehlskanal: string = "mein-roboter/befehl", rueckkanal: string = "mein-roboter/status"): void {
        // Platzhalter ignorieren: So kann ein Block mit echten Daten spaeter einrichten.
        if (gestartet || wlan == "WLAN_NAME_EINTRAGEN" || host == "MQTT_HOST_EINTRAGEN" || mqttPasswort == "MQTT_PASSWORT_EINTRAGEN") return
        if (wlan.length == 0 || host.length == 0 || befehlskanal.length == 0 || rueckkanal.length == 0 || befehlskanal == rueckkanal) return
        gestartet = true
        statuskanal = rueckkanal
        ESP8266_IoT.MqttEvent(befehlskanal, ESP8266_IoT.QosList.Qos0, befehl)
        motor.MotorRun(motor.Motors.M1, motor.Dir.CW, 0)
        motor.MotorRun(motor.Motors.M2, motor.Dir.CW, 0)
        servo(90)
        pins.setPull(DigitalPin.P1, PinPullMode.PullNone)
        neueSitzung()
        input.onButtonPressed(Button.B, function () { neueSitzung() })
        basic.forever(function () {
            if (fahrfreigabe && input.runningTime() - letzterFahrbefehl >= 600) stoppen(true)
            if (bereit && (!ESP8266_IoT.wifiState(true) || !ESP8266_IoT.isMqttBrokerConnected())) {
                bereit = false
                neueSitzung()
                basic.showIcon(IconNames.No)
            }
            basic.pause(20)
        })
        basic.forever(function () {
            if (bereit) {
                const status = "T|" + sitzung + "|" + sensorwert() + "|" + winkel + "|" + aktion1 + "|" + aktion2 + "|" + motorLinks + "|" + motorRechts
                ESP8266_IoT.publishMqttMessage(status, statuskanal, ESP8266_IoT.QosList.Qos0, false)
            }
            basic.pause(100)
        })
        control.inBackground(function () {
            // Zeit fuer das Registrieren der Schueler-Ereignisse lassen.
            basic.pause(100)
            ESP8266_IoT.initWIFI(SerialPin.P8, SerialPin.P12, BaudRate.BaudRate115200)
            ESP8266_IoT.connectWifi(wlan, wlanPasswort)
            if (ESP8266_IoT.wifiState(true)) {
                ESP8266_IoT.setMQTT(ESP8266_IoT.SchemeList.TLS, "fahrpult_" + control.deviceSerialNumber(), benutzer, mqttPasswort, "")
                ESP8266_IoT.connectMQTT(host, 8883, false)
                if (ESP8266_IoT.isMqttBrokerConnected()) {
                    neueSitzung()
                    bereit = true
                    basic.showIcon(IconNames.Yes)
                }
            }
            if (!bereit) basic.showIcon(IconNames.No)
        })
    }
}

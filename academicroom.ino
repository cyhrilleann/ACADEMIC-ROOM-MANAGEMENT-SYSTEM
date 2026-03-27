#include <SPI.h>
#include <MFRC522.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include "RTClib.h"
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>

// -------- PIN CONFIG --------
#define SS_PIN         32
#define RST_PIN        27
#define RELAY_PIN      5
#define BUZZER_PIN     4

MFRC522 rfid(SS_PIN, RST_PIN);
LiquidCrystal_I2C lcd(0x27, 16, 2);
RTC_DS3231 rtc;

// -------- SETTINGS --------
String masterID = "0BB02406";
const unsigned long CLASS_LIMIT_MS = 60000;  // 1 Minute limit for testing
const unsigned long WARNING_TIME_MS = 30000;

const char* ssid = "EECH TECH";
const char* password = "1234567eight";

// SCRIPT ID MULA SA GOOGLE APPS SCRIPT
String GAS_ID = "AKfycbxASfii_gfA6_Snw83ot_iMswDpekTjmVJcZPi10RBjWLlallV8rS15FG53hjk-0VifDw";

// -------- VARIABLES --------
bool classActive = false;
unsigned long startTime = 0;
unsigned long elapsedTime = 0;
unsigned long lastBeepTime = 0;

// -------- WIFI CONTROL --------
unsigned long lastWiFiAttempt = 0;
const unsigned long wifiInterval = 10000;

// -------- OFFLINE QUEUE --------
#define MAX_QUEUE 50
struct QueueItem {
  String action;
  String timestamp;
};
QueueItem queue[MAX_QUEUE];
int queueStart = 0;
int queueEnd = 0;

bool isQueueEmpty() { return queueStart == queueEnd; }
bool isQueueFull() { return ((queueEnd + 1) % MAX_QUEUE) == queueStart; }

// ====== TIMESTAMP FUNCTION (FIXED FOR PHT & ISO) ======
String twoDigits(int num) { return (num < 10 ? "0" : "") + String(num); }

String getTimestamp() {
  DateTime now = rtc.now();
  // Format: YYYY-MM-DDTHH:MM:SS (Standard ISO para sa Web at Google Sheets)
  String ts = String(now.year()) + "-" + twoDigits(now.month()) + "-" + twoDigits(now.day()) +
              "T" + twoDigits(now.hour()) + ":" + twoDigits(now.minute()) + ":" + twoDigits(now.second());
  return ts;
}

// ====== QUEUE FUNCTIONS ======
void enqueue(String action, String ts) {
  if (!isQueueFull()) {
    queue[queueEnd].action = action;
    queue[queueEnd].timestamp = ts;
    queueEnd = (queueEnd + 1) % MAX_QUEUE;
    Serial.println("Stored OFFLINE: " + action + " | " + ts);
  } else Serial.println("Queue FULL!");
}

bool dequeue(String &action, String &timestamp) {
  if (isQueueEmpty()) return false;
  action = queue[queueStart].action;
  timestamp = queue[queueStart].timestamp;
  queueStart = (queueStart + 1) % MAX_QUEUE;
  return true;
}

// ================= SETUP =================
void setup() {
  Serial.begin(115200);
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);

  SPI.begin(18, 19, 23);
  rfid.PCD_Init();
  Wire.begin(21, 22);

  if (!rtc.begin()) {
    Serial.println("RTC NOT FOUND");
  }

  // >>> STEP: I-SYNC ANG RTC SA ORAS NG PC MO NGAYON <<<
  // Matapos ang unang upload, i-comment out itong line sa ibaba at i-upload uli.
  rtc.adjust(DateTime(F(__DATE__), F(__TIME__))); 

  lcd.init();
  lcd.backlight();
  pinMode(RELAY_PIN, OUTPUT); 
  digitalWrite(RELAY_PIN, HIGH); // Relay OFF (Active Low)
  pinMode(BUZZER_PIN, OUTPUT);

  showReady();
}

// ================= LOOP =================
void loop() {
  handleWiFiReconnect();

  // Ipadala ang offline queue kapag may WiFi na
  if (WiFi.status() == WL_CONNECTED && !isQueueEmpty()) {
    String action, timestamp;
    if (dequeue(action, timestamp)) {
      if (!sendToGoogleSheets(action, timestamp)) {
        enqueue(action, timestamp); 
      } else {
        Serial.println("Offline data synced!");
      }
    }
  }

  if (classActive) {
    elapsedTime = (millis() - startTime);
    updateTimerDisplay(elapsedTime);

    unsigned long remainingTime = (elapsedTime < CLASS_LIMIT_MS ? (CLASS_LIMIT_MS - elapsedTime) : 0);
    if (remainingTime <= WARNING_TIME_MS && remainingTime > 0) {
      if (millis() - lastBeepTime > 3000) { beep(150); lastBeepTime = millis(); }
      lcd.setCursor(0, 0); lcd.print("Class ending   ");
    } else if (elapsedTime >= CLASS_LIMIT_MS) {
      lcd.setCursor(0, 0); lcd.print("OVERTIME       ");
    }
  } else displayRealTime();

  if (!rfid.PICC_IsNewCardPresent()) return;
  if (!rfid.PICC_ReadCardSerial()) return;

  String scannedID = "";
  for (byte i = 0; i < rfid.uid.size; i++) {
    scannedID += String(rfid.uid.uidByte[i] < 0x10 ? "0" : "");
    scannedID += String(rfid.uid.uidByte[i], HEX);
  }
  scannedID.toUpperCase();

  if (scannedID.equals(masterID)) {
    if (!classActive) { startClass(); handleSend("in"); }
    else { endClass(); handleSend("out"); }
  } else invalidCard();

  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();
}

void handleWiFiReconnect() {
  if (WiFi.status() != WL_CONNECTED && millis() - lastWiFiAttempt > wifiInterval) {
    WiFi.begin(ssid, password);
    lastWiFiAttempt = millis();
  }
}

void handleSend(String action) {
  String ts = getTimestamp();
  if (WiFi.status() == WL_CONNECTED) {
    if (!sendToGoogleSheets(action, ts)) enqueue(action, ts);
  } else {
    enqueue(action, ts);
  }
}

bool sendToGoogleSheets(String actionType, String timestamp) {
  if (WiFi.status() != WL_CONNECTED) return false;
  
  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;

  // Pinagsama ang URL at Parameters
  String url = "https://script.google.com/macros/s/" + GAS_ID + "/exec";
  url += "?name=Mr.%20Cabuyaban&room=AH%20E-LEARN%20LAB&action=" + actionType + "&timestamp=" + timestamp;
  
  http.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS);

  if (http.begin(client, url)) {
    int httpCode = http.GET();
    http.end();
    return (httpCode == 200 || httpCode == 302);
  }
  return false;
}

void startClass() {
  classActive = true; 
  startTime = millis(); 
  lastBeepTime = millis();
  lcd.clear(); 
  lcd.setCursor(0, 0); 
  lcd.print("Mr. Cabuyaban");
  digitalWrite(RELAY_PIN, LOW); // Relay ON
  beep(200); 
}

void endClass() {
  classActive = false; 
  digitalWrite(RELAY_PIN, HIGH); // Relay OFF
  lcd.clear(); 
  showReady(); 
  beep(300);
}

void updateTimerDisplay(unsigned long timeMillis) {
  unsigned long seconds = timeMillis / 1000;
  unsigned int minutes = (seconds % 3600) / 60;
  unsigned int secs = seconds % 60;
  lcd.setCursor(0, 1); 
  lcd.print("Timer: ");
  lcd.print(twoDigits(minutes)); 
  lcd.print(":"); 
  lcd.print(twoDigits(secs)); 
  lcd.print("   ");
}

void displayRealTime() {
  lcd.setCursor(0, 0); lcd.print(" TAP TO ENTER ");
  lcd.setCursor(0, 1); lcd.print("AH E-LEARN LAB");
}

void invalidCard() {
  lcd.clear(); 
  lcd.print("INVALID CARD"); 
  beep(100); delay(100); beep(100); 
  delay(1000); 
  showReady();
}

void showReady() {
  lcd.setCursor(0, 0); lcd.print(" TAP TO ENTER ");
  lcd.setCursor(0, 1); lcd.print("AH E-LEARN LAB");
}

void beep(int duration) {
  digitalWrite(BUZZER_PIN, HIGH); 
  delay(duration); 
  digitalWrite(BUZZER_PIN, LOW);
}

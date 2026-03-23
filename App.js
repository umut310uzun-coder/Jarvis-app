import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, StatusBar, Animated, Alert
} from 'react-native';
import * as Speech from 'expo-speech';
import * as Location from 'expo-location';

const GROQ_API_KEY = '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';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

const SYSTEM_PROMPT = `Sen Jarvis'sin, Umut'un kişisel sesli asistanısın. 
Türkçe konuş. Kısa ve net cevap ver. 
Tony Stark'ın Jarvis'i gibi profesyonel ve saygılı ol.
"Patron" diye hitap et.
Konum sorularında kullanıcının konumunu kullan.
Her zaman yardımcı olmaya çalış.`;

export default function App() {
  const [messages, setMessages] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [status, setStatus] = useState('Hazır');
  const [transcript, setTranscript] = useState('');
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const scrollRef = useRef(null);

  useEffect(() => {
    jarvisSpeak('Merhaba Patron. Jarvis hazır. Size nasıl yardımcı olabilirim?');
  }, []);

  useEffect(() => {
    if (isListening) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.3, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isListening]);

  const jarvisSpeak = (text) => {
    setIsSpeaking(true);
    setStatus('Konuşuyor...');
    Speech.speak(text, {
      language: 'tr-TR',
      pitch: 0.9,
      rate: 0.95,
      onDone: () => {
        setIsSpeaking(false);
        setStatus('Hazır');
      },
    });
  };

  const addMessage = (role, content) => {
    setMessages(prev => [...prev, { role, content, time: new Date().toLocaleTimeString('tr-TR') }]);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const getLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return null;
      const loc = await Location.getCurrentPositionAsync({});
      return loc.coords;
    } catch {
      return null;
    }
  };

  const searchWeb = async (query) => {
    try {
      const response = await fetch(
        `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`
      );
      const data = await response.json();
      if (data.AbstractText) return data.AbstractText;
      if (data.RelatedTopics?.[0]?.Text) return data.RelatedTopics[0].Text;
      return null;
    } catch {
      return null;
    }
  };

  const askGroq = async (userMessage, extraContext = '') => {
    try {
      const contextMessages = messages.slice(-6).map(m => ({
        role: m.role,
        content: m.content
      }));

      const finalMessage = extraContext
        ? `${userMessage}\n\nEk bilgi: ${extraContext}`
        : userMessage;

      const response = await fetch(GROQ_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            ...contextMessages,
            { role: 'user', content: finalMessage }
          ],
          max_tokens: 300,
          temperature: 0.7,
        }),
      });

      const data = await response.json();
      return data.choices?.[0]?.message?.content || 'Üzgünüm Patron, bir hata oluştu.';
    } catch (error) {
      return 'İnternet bağlantısı sorunu Patron.';
    }
  };

  const processCommand = async (text) => {
    const lower = text.toLowerCase();
    addMessage('user', text);
    setStatus('Düşünüyor...');

    let reply = '';

    // Konum komutu
    if (lower.includes('konum') || lower.includes('neredeyim') || lower.includes('benzin') ||
        lower.includes('eczane') || lower.includes('restoran') || lower.includes('hastane')) {
      setStatus('Konum alınıyor...');
      const coords = await getLocation();
      if (coords) {
        const context = `Kullanıcının konumu: Enlem ${coords.latitude.toFixed(4)}, Boylam ${coords.longitude.toFixed(4)}. Google Maps linki: https://maps.google.com/?q=${coords.latitude},${coords.longitude}`;
        reply = await askGroq(text, context);
      } else {
        reply = 'Konum iznine erişemiyorum Patron.';
      }
    }
    // Web araştırma komutu
    else if (lower.includes('araştır') || lower.includes('nedir') || lower.includes('nasıl') ||
             lower.includes('ne zaman') || lower.includes('kim') || lower.includes('haber')) {
      setStatus('Araştırıyor...');
      const webResult = await searchWeb(text);
      reply = await askGroq(text, webResult || '');
    }
    // Normal sohbet
    else {
      reply = await askGroq(text);
    }

    addMessage('assistant', reply);
    jarvisSpeak(reply);
  };

  // Ses tanıma — Web Speech API (WebView ile)
  const startListening = () => {
    if (isSpeaking) {
      Speech.stop();
      setIsSpeaking(false);
    }
    setIsListening(true);
    setStatus('Dinliyor...');
    setTranscript('');

    // Simüle edilmiş demo — gerçek ses için WebView entegrasyonu sonraki adım
    Alert.prompt(
      '🎤 Jarvis Dinliyor',
      'Komutunuzu yazın (yakında sesli olacak):',
      [
        { text: 'İptal', onPress: () => { setIsListening(false); setStatus('Hazır'); } },
        {
          text: 'Gönder',
          onPress: (text) => {
            setIsListening(false);
            if (text?.trim()) processCommand(text.trim());
            else setStatus('Hazır');
          }
        }
      ],
      'plain-text'
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0a" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>⚡ JARVIS</Text>
        <Text style={styles.headerSub}>Uzun Elektrik — Kişisel Asistan</Text>
        <View style={[styles.statusDot, { backgroundColor: isListening ? '#00ff88' : isSpeaking ? '#0088ff' : '#444' }]} />
      </View>

      {/* Mesajlar */}
      <ScrollView ref={scrollRef} style={styles.chatArea} contentContainerStyle={{ padding: 16 }}>
        {messages.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>🤖</Text>
            <Text style={styles.emptySubText}>Jarvis hazır. Mikrofona basın ve konuşun.</Text>
          </View>
        )}
        {messages.map((msg, i) => (
          <View key={i} style={[styles.bubble, msg.role === 'user' ? styles.userBubble : styles.jarviBubble]}>
            <Text style={styles.bubbleLabel}>{msg.role === 'user' ? '👤 Siz' : '🤖 Jarvis'}</Text>
            <Text style={styles.bubbleText}>{msg.content}</Text>
            <Text style={styles.bubbleTime}>{msg.time}</Text>
          </View>
        ))}
      </ScrollView>

      {/* Status */}
      <View style={styles.statusBar}>
        <Text style={styles.statusText}>{status}</Text>
        {transcript ? <Text style={styles.transcriptText}>"{transcript}"</Text> : null}
      </View>

      {/* Mikrofon Butonu */}
      <View style={styles.controls}>
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <TouchableOpacity
            style={[styles.micButton, isListening && styles.micButtonActive]}
            onPress={startListening}
            disabled={isSpeaking}
          >
            <Text style={styles.micIcon}>{isListening ? '🔴' : '🎤'}</Text>
            <Text style={styles.micLabel}>{isListening ? 'Dinliyor...' : 'Konuş'}</Text>
          </TouchableOpacity>
        </Animated.View>

        <TouchableOpacity style={styles.stopButton} onPress={() => { Speech.stop(); setIsSpeaking(false); setStatus('Hazır'); }}>
          <Text style={styles.stopIcon}>⏹</Text>
          <Text style={styles.stopLabel}>Durdur</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: { paddingTop: 50, paddingBottom: 16, paddingHorizontal: 20, backgroundColor: '#111', borderBottomWidth: 1, borderBottomColor: '#1a1a2e', alignItems: 'center' },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#00d4ff', letterSpacing: 6 },
  headerSub: { fontSize: 11, color: '#555', marginTop: 2 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginTop: 8 },
  chatArea: { flex: 1 },
  emptyState: { alignItems: 'center', marginTop: 80 },
  emptyText: { fontSize: 60 },
  emptySubText: { color: '#444', marginTop: 16, textAlign: 'center', fontSize: 14 },
  bubble: { marginBottom: 12, padding: 14, borderRadius: 16, maxWidth: '85%' },
  userBubble: { backgroundColor: '#1a1a2e', alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  jarviBubble: { backgroundColor: '#0d2137', alignSelf: 'flex-start', borderBottomLeftRadius: 4, borderLeftWidth: 3, borderLeftColor: '#00d4ff' },
  bubbleLabel: { fontSize: 10, color: '#555', marginBottom: 4 },
  bubbleText: { color: '#e0e0e0', fontSize: 15, lineHeight: 22 },
  bubbleTime: { fontSize: 9, color: '#333', marginTop: 6, textAlign: 'right' },
  statusBar: { paddingHorizontal: 20, paddingVertical: 10, backgroundColor: '#111', alignItems: 'center' },
  statusText: { color: '#00d4ff', fontSize: 13 },
  transcriptText: { color: '#888', fontSize: 12, marginTop: 4, fontStyle: 'italic' },
  controls: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 20, padding: 24, backgroundColor: '#111' },
  micButton: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#0d2137', borderWidth: 2, borderColor: '#00d4ff', alignItems: 'center', justifyContent: 'center' },
  micButtonActive: { backgroundColor: '#1a0000', borderColor: '#ff4444' },
  micIcon: { fontSize: 28 },
  micLabel: { color: '#00d4ff', fontSize: 10, marginTop: 4 },
  stopButton: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#333', alignItems: 'center', justifyContent: 'center' },
  stopIcon: { fontSize: 20 },
  stopLabel: { color: '#555', fontSize: 9, marginTop: 2 },
});

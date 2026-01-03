import { View, StyleSheet, Pressable, Text, Platform } from "react-native";
import { WebView } from "react-native-webview";
import { Colors } from "@/constants/colors";
import { t } from "@/constants/translations";
import { ExternalLink } from "lucide-react-native";
import * as Linking from "expo-linking";

interface MapViewEmbedProps {
  latitude: number;
  longitude: number;
  title?: string;
  markerColor?: string;
  height?: number;
}

export default function MapViewEmbed({ latitude, longitude, title, markerColor = Colors.primary, height = 180 }: MapViewEmbedProps) {
  const openInMaps = async () => {
    try {
      const url = Platform.select({
        ios: `maps://maps.apple.com/?q=${latitude},${longitude}`,
        android: `geo:${latitude},${longitude}?q=${latitude},${longitude}`,
        default: `https://www.google.com/maps?q=${latitude},${longitude}`,
      });

      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        await Linking.openURL(`https://www.google.com/maps?q=${latitude},${longitude}`);
      }
    } catch (error) {
      // Silently fail
    }
  };

  // Leaflet map HTML with dark theme tiles
  const mapHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body, #map { width: 100%; height: 100%; background: #1C1C1E; }
        .leaflet-control-attribution { display: none; }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        var map = L.map('map', {
          zoomControl: false,
          attributionControl: false,
          dragging: false,
          scrollWheelZoom: false,
          doubleClickZoom: false,
          touchZoom: false
        }).setView([${latitude}, ${longitude}], 16);

        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
          maxZoom: 19
        }).addTo(map);

        var marker = L.circleMarker([${latitude}, ${longitude}], {
          radius: 10,
          fillColor: '${markerColor}',
          color: '#fff',
          weight: 3,
          opacity: 1,
          fillOpacity: 1
        }).addTo(map);
      </script>
    </body>
    </html>
  `;

  const overlayButton = (
    <View style={styles.overlay}>
      <ExternalLink size={14} color={Colors.white} />
      <Text style={styles.overlayText}>{t.openMap}</Text>
    </View>
  );

  // Web platform - show placeholder
  if (Platform.OS === "web") {
    return (
      <Pressable onPress={openInMaps} style={[styles.container, { height }]}>
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>{t.mapView}</Text>
          <Text style={styles.coords}>{latitude.toFixed(4)}, {longitude.toFixed(4)}</Text>
        </View>
        {overlayButton}
      </Pressable>
    );
  }

  // Mobile - use WebView with Leaflet
  return (
    <Pressable onPress={openInMaps} style={[styles.container, { height }]}>
      <WebView
        source={{ html: mapHtml }}
        style={styles.webview}
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        originWhitelist={["*"]}
        javaScriptEnabled={true}
      />
      {overlayButton}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: Colors.backgroundTertiary,
  },
  webview: {
    flex: 1,
    backgroundColor: Colors.backgroundTertiary,
  },
  placeholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.backgroundTertiary,
  },
  placeholderText: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  coords: {
    fontSize: 12,
    color: Colors.textTertiary,
  },
  overlay: {
    position: "absolute",
    bottom: 10,
    right: 10,
    backgroundColor: Colors.glass,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  overlayText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: "500",
  },
});

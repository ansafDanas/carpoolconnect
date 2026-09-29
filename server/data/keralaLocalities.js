// Kerala localities used to sanity-check a map pin against the place a
// user typed. This is deliberately a small curated list rather than a full
// gazetteer: it covers the main corridors, and anything unknown simply
// falls back to the weaker regional checks instead of being rejected.
//
// Coordinates are approximate town centres. `radiusKm` is how far a pin
// may sit from that centre and still be considered the same place.

const K = (name, latitude, longitude, aliases = [], radiusKm = 12) => ({
  name,
  latitude,
  longitude,
  aliases,
  radiusKm,
});

const keralaLocalities = [
  // Ernakulam / Kochi corridor
  K("kochi", 9.9312, 76.2673, ["kochi", "cochin", "kochi metro"], 14),
  K("fort kochi", 9.9658, 76.2422, ["fort kochi", "fort cochin", "ernakulam"], 6),
  K("marine drive", 9.9756, 76.2722, ["marine drive", "marine drive road"], 6),
  K("kakkanad", 10.0156, 76.3425, ["kakkanad", "infopark", "infopark kochi"], 12),
  K("edappally", 10.0253, 76.3087, ["edappally", "edappally kochi"], 10),
  K("palarivattom", 9.9966, 76.3104, ["palarivattom"], 8),
  K("ernakulam", 9.9816, 76.2999, ["ernakulam", "ernakulam junction"], 12),
  K("vyttila", 9.9671, 76.3189, ["vyttila", "vyttila mob"], 8),
  K("alwaye", 10.0296, 76.3427, ["alwaye", "alva"], 10),
  K("kumbalanghi", 9.9970, 76.2830, ["kumbalanghi", "kumbalangi"], 8),
  K("thrikkakara", 10.0178, 76.2900, ["thrikkakara", "thrikkakara temple"], 8),
  K("kaloor", 10.0030, 76.2750, ["kaloor", "kaloor kochi"], 8),
  K("bananer shed", 9.9840, 76.2740, ["bananer shed", "banana shed"], 5),

  // Alappuzha
  K("alappuzha", 9.4981, 76.3388, ["alappuzha", "alleppey", "alappuzha town"], 14),
  K("alleppey beach", 9.4667, 76.3200, ["alleppey beach", "alleppey"], 8),
  K("marari", 9.6760, 76.3100, ["marari", "marari beach"], 8),
  K("kumarakom", 9.5633, 76.4000, ["kumarakom", "kumarakom bird sanctuary"], 8),
  K("haripad", 9.3200, 76.4700, ["haripad"], 8),

  // Kottayam / Pathanamthitta
  K("kottayam", 9.5911, 76.5135, ["kottayam"], 12),
  K("pattanamthitta", 9.3250, 76.7822, ["pathanamthitta", "pattanamthitta"], 12),
  K("kollam", 8.8932, 76.6141, ["kollam", "quilon"], 12),
  K("kayamkulam", 8.8870, 76.5560, ["kayamkulam"], 8),
  K("punalur", 8.8400, 76.6900, ["punalur"], 8),

  // Thiruvananthapuram
  K("thiruvananthapuram", 8.5241, 76.9366, ["thiruvananthapuram", "trivandrum", "tvm"], 14),
  K("technopark", 8.5480, 76.9180, ["technopark", "technopark trivandrum"], 8),
  K("vytilla", 8.5100, 76.9300, ["vytilla", "vytilla trivandrum"], 8),

  // Malabar
  K("thrissur", 10.5276, 76.2144, ["thrissur", "thrissur central"], 14),
  K("guruvayur", 10.6047, 76.0442, ["guruvayur", "guruvayoor"], 8),
  K("kozhikode", 11.2588, 75.7804, ["kozhikode", "calicut", "calicut city"], 14),
  K("malappuram", 11.0410, 76.0788, ["malappuram", "malappuram town"], 12),
  K("kannur", 11.8745, 75.3704, ["kannur", "cannanore", "cannanore"], 12),
  K("kasaragod", 12.4996, 74.9864, ["kasaragod"], 12),
  K("thalassery", 11.7463, 75.4894, ["thalassery", "tellicherry"], 8),
  K("wayanad", 11.6854, 76.1320, ["wayanad", "sultan bathery"], 20),
  K("idukki", 9.8498, 77.0601, ["idukki"], 20),

  // Others on the NH corridor
  K("ettumanoor", 9.6790, 76.7800, ["ettumanoor"], 8),
  K("adoor", 9.1150, 77.1180, ["adoor"], 8),
  K("changanassery", 9.3020, 76.6240, ["changanassery", "changanacherry"], 8),
];

export default keralaLocalities;
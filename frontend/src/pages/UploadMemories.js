import React from "react";

const DRIVE_URL = "https://drive.google.com/drive/folders/1WINFFH6JmlW1O9AAyxl35H-L4CppqYSp";

const C = { black:"#0D1310", gold:"#CFB53B", mgold:"#C2A454", cream:"#FDF8EE" };

export default function UploadMemories() {
  return (
    <div style={{ fontFamily:"'Poppins',-apple-system,sans-serif", background:C.black, color:C.cream, minHeight:"100vh", display:"flex", flexDirection:"column", overflowX:"hidden", position:"relative" }}>
      <div style={{ display:"flex", alignItems:"center", gap:"0.6rem", padding:"1.1rem 1.5rem", fontSize:"0.8rem", fontWeight:600, letterSpacing:"0.18em", textTransform:"uppercase", color:C.cream, borderBottom:"1px solid rgba(207,181,59,0.18)", zIndex:2 }}>
        <span>USLS-IS Batch 2003</span>
        <span style={{ color:C.gold }}>&#9679;</span>
        <span>25th Homecoming</span>
        <span style={{ marginLeft:"auto", color:C.mgold, fontWeight:500 }}>Memory Archive</span>
      </div>

      <div style={{ flex:1, display:"flex", flexDirection:"column", justifyContent:"center", padding:"3rem 1.5rem 4rem", position:"relative", zIndex:2 }}>
        <div style={{ position:"absolute", top:"50%", left:"50%", transform:"translate(-50%,-50%)", fontWeight:800, fontSize:"clamp(14rem,42vw,30rem)", color:"#fff", opacity:0.025, letterSpacing:"-0.04em", zIndex:-1, whiteSpace:"nowrap", userSelect:"none" }}>2003</div>

        <div style={{ maxWidth:640 }}>
          <span style={{ display:"inline-flex", alignItems:"center", gap:"0.5rem", fontSize:"0.72rem", fontWeight:600, letterSpacing:"0.22em", textTransform:"uppercase", color:C.gold, marginBottom:"1.6rem" }}>
            <span style={{ width:28, height:1, background:C.gold, display:"inline-block" }}></span>
            Share Your Memories
          </span>
          <h1 style={{ fontSize:"clamp(2.6rem,7vw,4.2rem)", lineHeight:1.02, fontWeight:700, letterSpacing:"-0.02em", color:"#fff", marginBottom:"1.6rem" }}>
            Throwback <em style={{ fontFamily:"'Gelasio',serif", fontStyle:"italic", fontWeight:400, color:C.gold }}>photos</em><br/>&amp; videos, please.
          </h1>
          <p style={{ fontSize:"1.15rem", lineHeight:1.6, color:"#b9c0b6", maxWidth:520, marginBottom:"2.6rem" }}>
            <span style={{ color:C.cream, fontWeight:500 }}>Padala lang kamo sang mga pictures or videos niyo halin high school.</span> We're collecting them for our 25th homecoming archive. Thank you!
          </p>
          <a href={DRIVE_URL} target="_blank" rel="noopener noreferrer" style={{ display:"inline-flex", alignItems:"center", gap:"0.9rem", background:C.gold, color:C.black, fontWeight:700, fontSize:"1.02rem", padding:"1.05rem 2.3rem", borderRadius:2, textDecoration:"none" }}>
            Upload to Batch Drive <span style={{ fontSize:"1.1rem" }}>&#8594;</span>
          </a>
          <div style={{ marginTop:"1.6rem", fontSize:"0.85rem", color:"#7c857a", display:"flex", alignItems:"center", gap:"0.6rem" }}>
            <span style={{ color:C.mgold }}>&#9679;</span> Sign in to Google to upload. Takes a minute.
          </div>
        </div>
      </div>
    </div>
  );
}

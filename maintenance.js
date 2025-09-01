// ВКЛ / ВЫКЛ режима обслуживания
const maintenance = true; // ← меняешь на false, когда включаешь приложение

if (maintenance) {
  document.addEventListener("DOMContentLoaded", () => {
    document.body.innerHTML = `
      <div style="
        display:flex;
        align-items:center;
        justify-content:center;
        height:100vh;
        text-align:center;
        font-family:sans-serif;
        background:#fafafa;
        color:#333;
        padding:20px;
      ">
        <div>
          <h1 style="margin-bottom:10px;">Ведутся технические работы</h1>
          <p>Ваши данные на месте, скоро всё заработает 🙌</p>
        </div>
      </div>
    `;
  });
}

import {test,expect} from "@playwright/test";
import {login,logout,CARLA,RAFAEL} from "../e2e/helpers";

test("visitantes e analistas não atravessam o espaço de demonstração",async({browser})=>{
  const a=await browser.newContext();
  const b=await browser.newContext();
  try {
    const pa=await a.newPage();
    const pb=await b.newPage();
    await login(pa,CARLA); await expect(pa).toHaveURL(/atendimento/);
    await login(pb,CARLA); await expect(pb).toHaveURL(/atendimento/);
    const va=await (await pa.request.get("/api/chat")).json();
    const vb=await (await pb.request.get("/api/chat")).json();
    expect(va.id).toBeTruthy(); expect(vb.id).toBeTruthy();
    expect(va.id).not.toBe(vb.id);
    // Carla começa esperando um humano: a mensagem é persistida sem chamar o modelo.
    const marker="mensagem privada do visitante A - teste E2E";
    const sent=await pa.request.post("/api/chat",{data:{text:marker}});
    expect(sent.ok()).toBe(true);
    expect(await (await pb.request.get("/api/chat")).text()).not.toContain(marker);
    await logout(pb); await login(pb,RAFAEL); await expect(pb).toHaveURL(/console/);
    const list=await (await pb.request.get("/api/console/conversations")).json();
    expect(list.map((c:{id:string})=>c.id)).not.toContain(va.id);
    expect((await pb.request.get(`/api/console/conversations/${va.id}`)).status()).toBe(404);
    expect((await pb.request.post(`/api/console/conversations/${va.id}`,{data:{action:"assume"}})).status()).toBe(404);
    expect((await pb.request.post(`/api/console/conversations/${va.id}/suggestion`)).status()).toBe(404);
    // O analista do mesmo navegador continua vendo a conversa correspondente.
    await logout(pa); await login(pa,RAFAEL); await expect(pa).toHaveURL(/console/);
    expect((await pa.request.get(`/api/console/conversations/${va.id}`)).status()).toBe(200);
  } finally {await a.close();await b.close();}
});

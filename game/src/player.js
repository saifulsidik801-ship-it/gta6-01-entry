// Milo Kade on foot — third-person character built from boxes, with
// walk/run, punch, shoot stance and car enter/exit. Keeps the player on
// the ground plane, out of buildings, and inside the city.
import * as THREE from '../vendor/three.module.min.js';
import { CONFIG } from './config.js';

export class Player {
  constructor(scene, x = 0, z = 40) {
    this.scene = scene;
    this.pos = new THREE.Vector3(x, 0, z);
    this.heading = Math.PI; // face the city
    this.speed = 0;
    this.health = CONFIG.player.health;
    this.armed = true;
    this.ammo = CONFIG.player.pistolAmmo;
    this.onFoot = true;
    this.vehicle = null;
    this.punchTimer = 0;
    this.shootTimer = 0;
    this.walkPhase = 0;
    this.group = new THREE.Group();
    this.group.name = 'player-milo';
    this.buildMesh();
    this.group.position.copy(this.pos);
    scene.add(this.group);
  }

  buildMesh() {
    const jacket = new THREE.MeshLambertMaterial({ color: 0xd8a03c }); // mustard jacket
    const jeans = new THREE.MeshLambertMaterial({ color: 0x2b3a55 });
    const skin = new THREE.MeshLambertMaterial({ color: 0xc98d64 });
    const cap = new THREE.MeshLambertMaterial({ color: 0x22262b });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.05, 0.5), jacket);
    body.position.y = 1.25;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), skin);
    head.position.y = 2.05;
    const hat = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.16, 0.56), cap);
    hat.position.y = 2.34;
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.85, 0.36), jeans);
    legL.position.set(-0.22, 0.43, 0);
    const legR = legL.clone(); legR.position.x = 0.22;
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.9, 0.3), jacket);
    armL.position.set(-0.58, 1.25, 0);
    const armR = armL.clone(); armR.position.x = 0.58;
    // pistol in the right hand when armed
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.42),
      new THREE.MeshLambertMaterial({ color: 0x111111 }));
    gun.position.set(0.58, 0.85, 0.25);
    gun.name = 'pistol';
    this.group.add(body, head, hat, legL, legR, armL, armR, gun);
    this.legL = legL; this.legR = legR; this.armL = armL; this.armR = armR; this.gun = gun;
  }

  // input: {x:-1..1 (strafe), z:-1..1 (forward), run:bool, dt}
  update(dt, input, world) {
    if (!this.onFoot) return;
    const speed = input.run ? CONFIG.player.run : CONFIG.player.walk;
    const mx = (input.x || 0) * speed;
    const mz = (input.z || 0) * speed;
    // movement is camera-relative: forward = away from camera heading
    const sin = Math.sin(this.heading), cos = Math.cos(this.heading);
    const vx = sin * mz + cos * mx;
    const vz = cos * mz - sin * mx;
    const moving = Math.abs(vx) + Math.abs(vz) > 0.1;
    let nx = this.pos.x + vx * dt;
    let nz = this.pos.z + vz * dt;
    [nx, nz] = world.resolveCollision(nx, nz, 0.7);
    nx = Math.max(-595, Math.min(595, nx));
    nz = Math.max(-595, Math.min(560, nz));
    this.pos.x = nx; this.pos.z = nz;
    this.speed = moving ? speed : 0;
    if (moving) {
      // face movement direction
      const target = Math.atan2(vx, vz);
      let d = target - this.heading;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      this.heading += d * Math.min(1, dt * 12);
      this.walkPhase += dt * speed * 1.6;
      const s = Math.sin(this.walkPhase) * 0.45;
      this.legL.rotation.x = s; this.legR.rotation.x = -s;
      this.armL.rotation.x = -s * 0.8; this.armR.rotation.x = s * 0.8;
    } else {
      this.legL.rotation.x *= 0.8; this.legR.rotation.x *= 0.8;
      this.armL.rotation.x *= 0.8; this.armR.rotation.x *= 0.8;
    }
    this.punchTimer = Math.max(0, this.punchTimer - dt);
    this.shootTimer = Math.max(0, this.shootTimer - dt);
    if (this.punchTimer > 0) this.armR.rotation.x = -1.4;
    this.group.position.set(this.pos.x, 0, this.pos.z);
    this.group.rotation.y = this.heading;
    this.gun.visible = this.armed;
  }

  punch() {
    if (!this.onFoot || this.punchTimer > 0) return false;
    this.punchTimer = 0.4;
    return true;
  }

  enterVehicle(vehicle) {
    this.vehicle = vehicle;
    this.onFoot = false;
    this.group.visible = false;
  }

  exitVehicle() {
    if (!this.vehicle) return;
    const v = this.vehicle;
    const sx = v.pos.x - Math.sin(v.heading + Math.PI / 2) * 2.4;
    const sz = v.pos.z - Math.cos(v.heading + Math.PI / 2) * 2.4;
    this.pos.set(sx, 0, sz);
    this.heading = v.heading;
    this.vehicle = null;
    this.onFoot = true;
    this.group.visible = true;
    this.group.position.copy(this.pos);
  }

  takeDamage(n) {
    this.health -= n;
    if (this.health < 0) this.health = 0;
    return this.health <= 0;
  }
  heal(n) { this.health = Math.min(100, this.health + n); }
  get dead() { return this.health <= 0; }
  get position() { return this.onFoot ? this.pos : this.vehicle.pos; }
}

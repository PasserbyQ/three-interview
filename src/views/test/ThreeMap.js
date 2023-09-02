/*


使用方式
let props={domID:"three-dom"}
this.map = new ThreeMap(props[,dataJson]);
this.map.init();
*/
import * as THREE from 'three';
import 'imports-loader?THREE=three!threebsp'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader'
import {OBJLoader2 } from 'three/examples/jsm/loaders/OBJLoader2'
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter'
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader'
// import TWEEN from '@tweenjs/tween.js'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial'
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'   //r100及以上
// var OrbitControls = require('three-orbit-controls')(THREE)  //r100 以下
//发光
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass.js'
// import { FXAAShader } from 'three/examples/js/shaders/FXAAShader.js';

import fs from '../../../public/images/test/fs.glsl'
import vs from '../../../public/images/test/vs.glsl'

export default class ThreeMap {
    constructor(props,dataJson) {

        this.props=props;
        this.ThreeData=dataJson;
        this.dataJson=dataJson;
        this.objList = dataJson.objects||[];//对象列表
        this.eventList = dataJson.events||{};//事件对象列表
        this.btnList = dataJson.btns||[];//按钮列表
        this.alarmColor=Object.assign({
            level1:"#00c5ff",
            level2:"#b0f604",
            level3:"#fcff00",
            level4:"#ff8d00",
            level5:"#ff0000",
        },dataJson.alarmColor);
        
        this.renderer=null;
        this.scene = null;//场景
        this.camera=null;
        this.objects = [];  //存放对象
        this.equipment=[];  //存放设备
        this.sprite=[];  //存放告警精灵图标
        this.cabinet=[];  //存放柜子
        this.dom=document.getElementById(this.props.domID);
        this.dbclick = 0;
        this.mouseClick = new THREE.Vector2();
        this.raycaster = new THREE.Raycaster();
        this.lastElement=null;  //存放最后一个设备
        this.tipTimer=null; //显示提示用的timer
        this.tooltip=null;
        this.lastEvent=null;
        this.tooltipBG='#ACDEFE';

        //轮廓线
        this.composer=null;
        this.outlinePass=null;

        this.progressSuccess=0;
        this.loadtimer=null;
        this.BASE_PATH="./images/"
    }

    init() {
        this.initRenderer();
        this.initScene();
        this.initCamera();
        this.initLight();
        this.render();
        // this.setHelper();
        this.setControl();
        // this.add();
        this.InitData();  //添加3D对象、事件等
        // this.renderer.domElement.addEventListener('mousedown', this.onDocumentMouseDown.bind(this), false);
        // this.renderer.domElement.addEventListener('mousemove',this.onDocumentMouseMove.bind(this), false);
    }

    //初始化渲染场景
    initRenderer() {
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(this.dom.offsetWidth,this.dom.offsetHeight);
        this.dom.appendChild(this.renderer.domElement);
    }
    //初始化相机
    initCamera() {
        this.camera = new THREE.PerspectiveCamera(45, this.dom.offsetWidth / this.dom.offsetHeight, 1, 10000);
        this.camera.name = 'mainCamera';
        this.camera.position.set(0,0,120)
        //默认就是以Y轴为上方的
        // this.camera.up.x = 0;
        // this.camera.up.y =1;
        // this.camera.up.z =0;
        this.camera.lookAt({ x: 0, y: 0, z: 0 });
        this.scene.add(this.camera);
    }
    //初始化场景
    initScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x225F93);
    }
    //初始化灯光
    initLight(){
        var light = new THREE.AmbientLight(0xcccccc);
        light.position.set(0, 0,0);
        this.scene.add(light);
        var light2 = new THREE.PointLight(0x555555);
        light2.shadow.camera.near =1;
        light2.shadow.camera.far = 5000;
        light2.position.set(0, 350, 0);
        light2.castShadow = true;//表示这个光是可以产生阴影的
        this.scene.add(light2);
    }
    //渲染
    render() {
        this.animate()
    }
    animate() {
        requestAnimationFrame(this.render.bind(this));
        this.renderer.render(this.scene, this.camera);
    }
    setHelper() {
        //红色x,绿色y,蓝色z
        const axesHelper = new THREE.AxisHelper(5);
        this.scene.add(axesHelper);
    }
    //鼠标拖拽控制
    setControl() {
        this.controls = new OrbitControls(this.camera,this.dom);
        this.controls.update();
    }
    //测试函数
    InitData(){
        // this.setOutside()
        // this.autoGeometry();
        // this.createFBX()
        // this.createGLTF()
        this.createOBJ()
    }
    
    //六面体形状
    autoGeometry(){
        /*
		  5____4
		0/___1/|
		| 7__|_6
		2/___3/
        
          5____4
		1/___0/|
		| 6__|_7
		2/___3/
		0: max.x, max.y, max.z
		1: min.x, max.y, max.z
		2: min.x, min.y, max.z
		3: max.x, min.y, max.z
		4: max.x, max.y, min.z
		5: min.x, max.y, min.z
		6: min.x, min.y, min.z
		7: max.x, min.y, min.z
		*/
        var geometry = new THREE.Geometry();
        var p0 = new THREE.Vector3(500, 500, 500);
        var p1 = new THREE.Vector3(0, 500, 500);
        var p2 = new THREE.Vector3(0, 0, 500);
        var p3 = new THREE.Vector3(500, 0, 500);
        var p4 = new THREE.Vector3(500, 500, 0);
        var p5 = new THREE.Vector3(0, 500, 0);
        var p6 = new THREE.Vector3(0, 0, 0);
        var p7 = new THREE.Vector3(500, 0, 0);
        //顶点坐标添加到geometry对象
        geometry.vertices.push(p0,p1, p2, p3,p4,p5,p6,p7);

        var face0 = new THREE.Face3(0,3,4);
        var face1 = new THREE.Face3(3,7,4);
        var face2 = new THREE.Face3(1,5,2);
        var face3 = new THREE.Face3(5,6,2);
        var face4 = new THREE.Face3(0,4,1);
        var face5 = new THREE.Face3(4,5,1);
        var face6 = new THREE.Face3(2,6,3);
        var face7 = new THREE.Face3(6,7,3);
        var face8 = new THREE.Face3(0,1,3);
        var face9 = new THREE.Face3(1,2,3);
        var face10 = new THREE.Face3(5,4,6);
        var face11 = new THREE.Face3(4,7,6);

        //三角面face1、face2添加到几何体中
        geometry.faces.push(face0,face1,face2,face3,face4,face5,face6,face7,face8,face9,face10,face11);

        //六面颜色
        for (var i = 0; i < geometry.faces.length; i += 2) {
            let skinColor=Math.random() * 0xffffff;
            geometry.faces[i].color.setHex(skinColor);
            geometry.faces[i + 1].color.setHex(skinColor);
        }
        //六面纹理
        let mats=[];
        for(let i = 0;i<geometry.faces.length;i++){
            let material = new THREE.MeshBasicMaterial({vertexColors: THREE.FaceColors});
            mats.push(material);
        }
        var mesh = new THREE.Mesh(geometry, mats); //网格模型对象Mesh

        var obj=new THREE.Object3D();
        obj.add(mesh)
        this.scene.add(obj)
    }

    Loading(){
        var div = document.createElement('div');
		div.setAttribute('id', 'loading');
		div.style.display = 'block';
		div.style.position = 'absolute';
		div.style.left = '0';
		div.style.top = '0';
		div.style.width = '100%';
        div.style.height = '100%';
        div.style.fontSize="30px";
        div.style.zIndex="999";
        div.style.background = 'rgba(0,0,0,0.65)';
        let loading=document.createElement('div');
        loading.innerHTML="模型加载中...";
        loading.style.top="40%";
        loading.style.position="absolute";
        loading.style.width="100%";
        loading.style.textAlign="center";
        div.appendChild(loading);
		this.dom.appendChild(div);
    }
    //创建皮肤材质操作
    createSkinOption (width,height, obj, cube,cubeColor, cubefacenub) {
        if (this.commonFunc.hasObj(obj)) {
            if (this.commonFunc.hasObj(obj.imgurl)) {
                var MaterParam={
                    color:cubeColor,
                    map: this.createSkin(width, height, obj),
                    opacity: obj.opacity||1,
                }
                if(obj.transparent){
                    MaterParam.transparent=obj.transparent;
                }
                if (obj.blending) {
                    MaterParam.blending = THREE.AdditiveBlending//使用饱和度叠加渲染
                }
                return MaterParam;
            } else {
                if (this.commonFunc.hasObj(obj.skinColor)) {
                    cube.faces[cubefacenub].color.setHex(obj.skinColor);
                    cube.faces[cubefacenub + 1].color.setHex(obj.skinColor);
                }
                return {
                    vertexColors: THREE.FaceColors
                }
            }
        } else {
            return {
                vertexColors: THREE.FaceColors
            }
        }
    }
    //使用材质图片
    createSkin (width,height,obj) {
        var imgwidth = 128,imgheight=128;
        if (obj.width != null&& typeof (obj.width) != 'undefined') {
            imgwidth = obj.width;
        }
        if (obj.height != null && typeof (obj.height) != 'undefined') {
            imgheight = obj.height;
        }
        var texture = new THREE.TextureLoader().load(this.commonFunc.getPath(obj.imgurl));
        var repeat = false;
        if (obj.repeatx != null && typeof (obj.repeatx) != 'undefined' && obj.repeatx==true) {
            texture.wrapS = THREE.RepeatWrapping;
            repeat = true;
        }
        if (obj.repeaty != null && typeof (obj.repeaty) != 'undefined' && obj.repeaty == true) {
            texture.wrapT = THREE.RepeatWrapping;
            repeat = true;
        }
        if (repeat) {
            texture.repeat.set(width / imgwidth, height / imgheight);
        }
        return texture;
    }
    
    commonFunc={
        _this:this,
        //判断对象
        hasObj: function (obj) {
            if (obj != null && typeof (obj) != 'undefined') {
                return true;
            }else{
                return false;
            }
        },
        //查找对象
        findObject: function (objname) {
            var findedobj = null;
            this.objects.forEach(function(obj, index){
                if (obj.name != null && obj.name != '' && obj.name == objname) {
                    findedobj = obj;
                    return findedobj;
                }
            });
            return findedobj;
        },
        //获取路径
        getPath: function(file){
            return this._this.BASE_PATH+file;
        },
        //生成GUID
        guid:function(){
            return (this.guidRandom()+this.guidRandom()+"-"+this.guidRandom()+"-"+this.guidRandom()+"-"+this.guidRandom()+"-"+this.guidRandom()+this.guidRandom()+this.guidRandom()); 
        },
        guidRandom() { 
            return (((1+Math.random())*0x10000)|0).toString(16).substring(1); 
        }
    }


    /*
    *事件部分
    */
    
    //测试
    add(){
        var _this=this;
        //测试生成obj带材质
        // this.createObjContainMtl()

        //3,测点管道
        // var points = [];
        // points.push(new THREE.Vector3(0, 0, -10));
        // points.push(new THREE.Vector3(0, 0, 10));
        // var curvePath = new THREE.CatmullRomCurve3(points);
        // var geometry = new THREE.TubeGeometry( curvePath, 20, 2, 8, false );
        // var material = new THREE.MeshBasicMaterial( { color: 0xff0000 ,side:THREE.DoubleSide } );
        // var mesh = new THREE.Mesh( geometry, material );
        // this.scene.add( mesh );
        ////自定义管道
        // var cylinderGeo = new THREE.CylinderGeometry(4, 4 ,20 ,48,48);
        // var cylinderMat = new THREE.MeshLambertMaterial({
        //     color:0xffffff,
        //     side:THREE.DoubleSide,
        //     // map: this.createSkin(64,64,{imgurl:"./images/rack_inside.png"})
        // });
        // var cylinderMat2 = new THREE.MeshLambertMaterial({
        //     color:0xffffff,
        //     side:THREE.DoubleSide,
        //     // map: this.createSkin(64,64,{imgurl:"./images/test/camera.png"})
        // });
        // var cylinder = new THREE.Mesh(cylinderGeo, cylinderMat);
        // var cubeGeometry = new THREE.CubeGeometry(6.5, 20, 6.5, 0, 0, 1);
        // var cube = new THREE.Mesh(cubeGeometry, cylinderMat);
        // var pipe = this.mergeModel('+',cylinder,cube);
        // var cylinderGeo1 = new THREE.CylinderGeometry(3.5, 3.5 ,20 ,48,48);
        // var cylinder1 = new THREE.Mesh(cylinderGeo1, cylinderMat);
        // pipe=this.mergeModel("-",pipe,cylinder1);
        // var cylinderGeo2 = new THREE.CylinderGeometry(2.5, 2.5 ,20 ,48,48);
        // var cylinder2 = new THREE.Mesh(cylinderGeo2, cylinderMat2);
        // pipe=this.mergeModel("+",pipe,cylinder2);
        // pipe.rotateX(0.5*Math.PI);
        // this.scene.add(pipe);//网格模型添加到场景中

        //4.测试加载模型
        // var texture = new THREE.TextureLoader().load( './images/test/metal.png' );
        // var texture1 = new THREE.TextureLoader().load( './images/test/camera_light.png' );
        // var texture2 = new THREE.TextureLoader().load( './images/test/camera_dot.png' );
        // var loader =new OBJLoader();
        // loader.load( './images/test/camera.obj', function ( group ) {
        //     console.log(group)
        //     group.traverse( function ( child ) {
        //         console.log(child)
        //         if ( child instanceof THREE.Mesh) {
        //             if(child.name=="archmodels95_044_001"){
        //                 child.material.map = texture;
        //             }else if(child.name=="archmodels95_044_003"){
        //                 child.material.map = texture1;
        //             }else{
        //                 child.material.map = texture2;
        //             }
                  
        //         }
        //     });
        //     _this.scene.add( group );
        // })

        //测试加载材质模型
        // var mtlLoader = new MTLLoader();
        // mtlLoader.load('./images/test/plant.mtl', function(materials) {
        //     materials.preload();
        //     console.log(materials)-
        //     var objLoader = new OBJLoader();
        //     objLoader.setMaterials(materials);
        //     objLoader.load('./images/test/plant.obj', function(object) {
        //         console.log(object)
        //         _this.scene.add(object);
        //     }, onProgress, onError);
        // });
        // var onProgress = function(xhr) {
        //     if (xhr.lengthComputable) {
        //         var percentComplete = xhr.loaded / xhr.total * 100;
        //         console.log(Math.round(percentComplete, 2) + '% 已经加载')
        //     }
        // }
        // var onError =function(){}

        //1、测试ThreeBSP用的
        //几何体对象
        // let cylinder = new THREE.CylinderGeometry(500,500,5,40);//圆柱
        // let box = new THREE.BoxGeometry(40,5,40);//立方体
        // //材质对象
        // let material=new THREE.MeshPhongMaterial({color:0x0000ff});
        // //网格模型对象
        // let cylinderMesh=new THREE.Mesh(cylinder,material);//圆柱
        // let boxMesh=new THREE.Mesh(box,material);//立方体
        // //包装成ThreeBSP对象
        // let cylinderBSP = new ThreeBSP(cylinderMesh);
        // let boxBSP = new ThreeBSP(boxMesh);
        // let result = cylinderBSP.subtract(boxBSP);
        // //ThreeBSP对象转化为网格模型对象
        // let mesh = result.toMesh();
        // this.scene.add(mesh);//网格模型添加到场景中

        // //2、试圆柱体贴图
        // //创建圆柱体
        // var cylinderGeo = new THREE.CylinderGeometry(28, 30 ,200 ,48,48);
        // cylinderGeo.computeBoundingBox(); 
        // var max = cylinderGeo.boundingBox.max,
        //         min = cylinderGeo.boundingBox.min;
        //         console.log(cylinderGeo)
        //         console.log(max)
        //         console.log(min)
        // var offset = new THREE.Vector2(0 - min.x, 0 - min.y);
        // var range = new THREE.Vector2(max.x - min.x, max.y - min.y);
        // var faces = cylinderGeo.faces; 
        // cylinderGeo.faceVertexUvs[0] = []; 
        // for (var i = 0; i < faces.length ; i++) { 
        //     var v1 = cylinderGeo.vertices[faces[i].a],
        //             v2 = cylinderGeo.vertices[faces[i].b],
        //             v3 = cylinderGeo.vertices[faces[i].c]; 
        //     cylinderGeo.faceVertexUvs[0].push([
        //         new THREE.Vector2((v1.x + offset.x) / range.x, (v1.y + offset.y) / range.y),
        //         new THREE.Vector2((v2.x + offset.x) / range.x, (v2.y + offset.y) / range.y),
        //         new THREE.Vector2((v3.x + offset.x) / range.x, (v3.y + offset.y) / range.y)
        //     ]);
        // }
        // cylinderGeo.uvsNeedUpdate = true;
        

        // console.log(cylinderGeo)
        // var cylinderMat = new THREE.MeshLambertMaterial({//创建材料
        //     color:0xffffff,
        //     wireframe:false,
        //     opacity: 0.1,
        //     map: this.createSkin(60,200,{imgurl:"./images/aircondition.png"})
        // });
        // //创建圆柱体网格模型
        // var cylinder = new THREE.Mesh(cylinderGeo, cylinderMat);
        // this.scene.add(cylinder);//网格模型添加到场景中

    }
   
    //测试
    createFBX(obj){
        let _this=this;
        var fbxLoader = new FBXLoader();
        fbxLoader.load(_this.commonFunc.getPath('rack/2-5-E-max.fbx'), function(object) {
            console.log(object)
            _this.scene.add( object );
        });
    }

    createGLTF(obj){
        let _this=this;

        const geometry = new THREE.PlaneGeometry(20, 40); 

        var leaftexture = new THREE.TextureLoader().load( './images/plant/Archmodels66_leaf_33.jpg' );

        const material = new THREE.MeshLambertMaterial({
            // 设置纹理贴图：Texture对象作为材质map属性的属性值
            map: leaftexture,//map表示材质的颜色贴图属性
            transparent: true, 
        });

        var cylinder = new THREE.Mesh(geometry, material);
        // cylinder.rotateY(-Math.PI / 2);
        cylinder.position.z = 11


        var fbxLoader = new GLTFLoader();
        fbxLoader.load('./images/test/object.gltf', function(object) {
            console.log(object)
            object.scene.add(cylinder)
            _this.scene.add( object.scene );
        });
    }

    createOBJ(obj){
        var _this=this;

        const geometry = new THREE.PlaneGeometry(4, 3); 

        var leaftexture = new THREE.TextureLoader().load( _this.commonFunc.getPath('test/msl.png') );

        const material = new THREE.MeshLambertMaterial({
            // 设置纹理贴图：Texture对象作为材质map属性的属性值
            map: leaftexture,//map表示材质的颜色贴图属性
            transparent: true, 
        });

        var cylinder = new THREE.Mesh(geometry, material);
        cylinder.rotateY(Math.PI / 2);
        cylinder.position.y = 1
        // cylinder.position.z = 50
        cylinder.position.x = 1.3




        // var mtlLoader = new MTLLoader();
        // mtlLoader.load(_this.commonFunc.getPath('camera/camera.mtl'), function(materials) {
        //     materials.preload();
        //     var objLoader = new OBJLoader();
        //     objLoader.setMaterials(materials);
        //     objLoader.load(_this.commonFunc.getPath('camera/camera.obj'), function(object) {
        //         console.log('camera__object',object);
        //         object.add(cylinder)

        //         _this.scene.add( object );

        //     });
        // });


        
        var objLoader = new OBJLoader();
        // const shaderMaterial = new THREE.ShaderMaterial({
        //     vertexShader:vs,
        //     fragmentShader:fs
        // })
            // objLoader.setMaterials(materials);

            var tu = new THREE.TextureLoader().load( _this.commonFunc.getPath('test/tu.png') );


            const materials = new THREE.MeshLambertMaterial({
                // 设置纹理贴图：Texture对象作为材质map属性的属性值
                map: tu,//map表示材质的颜色贴图属性
            }); 
        objLoader.load(_this.commonFunc.getPath('test/ak47.obj'), function(object) {
            console.log('camera__object',object);
            object.add(cylinder)
            object.rotateY(-Math.PI / 2);
            const mesh = object.children[0]
            // const mesh1 = object.children[1]

            mesh.material = materials
            // mesh1.material = material

            _this.scene.add( object );

        });
    }
    
}